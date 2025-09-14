import { FetchPortfolioMovementsRequest } from "../model/fetch-portfolio-movements.request";
import { HttpError } from "../../../common/error/HttpError";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import { logger } from "../../logger/logger";
import { XcmService } from "../../blockchain/substrate/services/xcm.service";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { determineLabelForPayment } from "../helper/determine-label-for-payment";
import { PortfolioMovementsResponse } from "../model/portfolio-movements.response";
import { SpecialEventsToTransfersService } from "./special-event-processing/special-events-to-transfers.service";
import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";
import { PortfolioMovement } from "../model/portfolio-movement";
import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { Transaction } from "../../blockchain/substrate/model/transaction";
import { StakingRewardsAggregatorService } from "./staking-rewards-aggregator.service";
import { AddFiatValuesToTaxableEventsService } from "./add-fiat-values-to-taxable-events.service";
import { DataPlatformLiquidStakingService } from "../../data-platform-api/data-platform-liquidstaking.service";
import * as fs from "fs";
import { ReconciliationService } from "./reconciliation.service";
import { EventDerivedTransfer } from "../model/event-derived-transfer";
import { BalanceChangesService } from "./balance-changes.service";
import { isEvmAddress } from "../helper/is-evm-address";
import { simplifyAssetMovementsSemanticId } from "../helper/simplify-asset-movements";

export async function awaitPromisesAndLog<T>(
  promises: Promise<any>[],
): Promise<any[]> {
  let settled = 0;
  const wrapped = promises.map((p, i) =>
    p
      .then((v) => {
        settled++;
        logger.info(`[Promise-${i}] resolved (${settled}/${promises.length})`);
        return v;
      })
      .catch((err) => {
        settled++;
        logger.error(
          `[Promise-${i}] rejected (${settled}/${promises.length}):`,
          err,
        );
        throw err;
      }),
  );
  return Promise.all(wrapped);
}

export class PortfolioMovementsService {
  constructor(
    private subscanService: SubscanService,
    private xcmService: XcmService,
    private stakingRewardsAggregatorService: StakingRewardsAggregatorService,
    private specialEventsToTransfersService: SpecialEventsToTransfersService,
    private addFiatValuesToTaxableEventsService: AddFiatValuesToTaxableEventsService,
    private dataPlatformLiquidStakingService: DataPlatformLiquidStakingService,
    private balanceChangesService: BalanceChangesService,
    private reconciliationService: ReconciliationService,
  ) {}

  private validate(request: FetchPortfolioMovementsRequest) {
    let { chain } = request;
    if (!subscanChains.chains.find((p) => p.domain === chain.domain)) {
      throw new HttpError(400, "Chain " + chain.domain + " not found");
    }
  }

  private async fetchData(request: FetchPortfolioMovementsRequest) {
    const chainExtendedRequest = {
      ...request,
      chainName: request.chain.domain,
    };
    let [transactions, events, xcmList, stakingRewards, dataPlatformTransfers] =
      await awaitPromisesAndLog([
        this.subscanService.fetchAllTx(chainExtendedRequest),
        this.subscanService.searchAllEvents(chainExtendedRequest),
        this.xcmService.fetchXcmTransfers(chainExtendedRequest),
        this.stakingRewardsAggregatorService.fetchStakingRewards(
          chainExtendedRequest,
        ),
        process.env["USE_DATA_PLATFORM_API"] === "true"
          ? this.dataPlatformLiquidStakingService.fetchallVtokenEvents(
              request.address,
              request.chain.domain,
              request.minDate,
            )
          : Promise.resolve([]),
      ]);

    if (request.maxDate) {
      transactions = transactions.filter((t) => t.timestamp <= request.maxDate);
      events = events.filter((e) => e.timestamp <= request.maxDate);
      xcmList = xcmList.filter((e) => e.timestamp <= request.maxDate);
      stakingRewards = stakingRewards.filter(
        (e) => e.timestamp <= request.maxDate,
      );
      dataPlatformTransfers = dataPlatformTransfers.filter(
        (e) => e.timestamp <= request.maxDate,
      );
    }

    return [
      transactions,
      events,
      xcmList,
      stakingRewards,
      dataPlatformTransfers,
    ];
  }

  private async transform(
    request: FetchPortfolioMovementsRequest,
    transactions: Transaction[],
    events: SubscanEvent[],
    xcmList: XcmTransfer[],
    stakingRewards: StakingReward[],
    dataPlatformTransfers: Transfer[],
  ) {
    const specialEventTransfers =
      await this.specialEventsToTransfersService.handleEvents(
        request.chain,
        events,
        xcmList,
      );

    const aliases = isEvmAddress(request.address)
      ? [
          await this.subscanService.mapToSubstrateAccount(
            request.chain.domain,
            request.address,
          ),
        ]
      : await this.subscanService.fetchAccounts(
          request.address,
          request.chain.domain,
        );

    const isMyAccount = (addressToTest: string) =>
      addressToTest &&
      (request.address.toLowerCase() === addressToTest.toLowerCase() ||
        aliases.indexOf(addressToTest) > -1);

    const specialTransfers = [];
    dataPlatformTransfers.forEach((t) => specialTransfers.push(t));
    specialEventTransfers.forEach((t) => specialTransfers.push(t));
    specialTransfers.forEach((t) => {
      t.amount = isMyAccount(t.to) ? Math.abs(t.amount) : -Math.abs(t.amount);
    });

    let portfolioMovements =
      await this.balanceChangesService.fetchAllBalanceChanges(
        request,
        events,
        isMyAccount,
      );

    await this.reconciliationService.reconcile(
      request.chain,
      portfolioMovements,
      transactions,
      specialTransfers as EventDerivedTransfer[],
      xcmList,
      stakingRewards,
      events,
    );

    portfolioMovements = simplifyAssetMovementsSemanticId(
      request.address,
      portfolioMovements,
    );

    return { portfolioMovements };
  }

  private addLabels(
    request: FetchPortfolioMovementsRequest,
    portfolioMovements: PortfolioMovement[],
  ) {
    portfolioMovements.forEach(
      (p) => (p.label = determineLabelForPayment(request.chain.domain, p)),
    );
  }

  async fetchPortfolioMovements(
    request: FetchPortfolioMovementsRequest,
  ): Promise<PortfolioMovementsResponse> {
    logger.info(
      `PortfolioMovementsService: Enter fetchPortfolioMovements for ${request.chain.domain} and wallet ${request.address}`,
    );
    this.validate(request);

    logger.info(
      `PortfolioMovmentService: Fetch all data for ${request.chain.domain} and wallet ${request.address}`,
    );
    let [transactions, events, xcmList, stakingRewards, dataPlatformTransfers] =
      await this.fetchData(request);

    logger.info(
      `PortfolioMovmentService: Transforming data for ${request.chain.domain} and wallet ${request.address}`,
    );
    let { portfolioMovements } = await this.transform(
      request,
      transactions,
      events,
      xcmList,
      stakingRewards,
      dataPlatformTransfers,
    );

    logger.info(
      `PortfolioMovmentService: Adding labels for ${request.chain.domain} and wallet ${request.address}`,
    );
    this.addLabels(request, portfolioMovements);

    logger.info(
      `PortfolioMovmentService: Adding/converting fiat values for ${request.chain.domain} and wallet ${request.address}`,
    );
    await this.addFiatValuesToTaxableEventsService.addFiatValues(
      request,
      portfolioMovements,
    );

    if (request.maxDate) {
      portfolioMovements = portfolioMovements.filter(
        (t) => t.timestamp <= request.maxDate,
      );
    }

    logger.info(
      `PortfolioMovmentService: Sorting taxable events ${request.chain.domain} and wallet ${request.address}`,
    );
    const sortedTaxableEvents = portfolioMovements.sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    logger.info(
      `PortfolioMovementsService: Exit fetchPortfolioMovements with ${portfolioMovements.length} entries for ${request.chain.domain} and wallet ${request.address}`,
    );

    if (process.env["WRITE_RESULTS_TO_DISK"] === "true") {
      fs.writeFileSync(
        `./logs/${request.chain.domain}-${request.address}.json`,
        JSON.stringify(sortedTaxableEvents, null, 2),
      );
    }

    return { portfolioMovements: sortedTaxableEvents, unmatchedEvents: events };
  }
}
