import { FetchPortfolioMovementsRequest } from "../model/fetch-portfolio-movements.request";
import { evmChainConfigs } from "../../blockchain/evm/constants/evm-chains.config";
import { HttpError } from "../../../common/error/HttpError";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import { logger } from "../../logger/logger";
import { XcmService } from "../../blockchain/substrate/services/xcm.service";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { TransactionsService } from "../../blockchain/substrate/services/transactions.service";
import { ChainAdjustments } from "../helper/chain-adjustments";
import { ChainDataAccumulationService } from "./chain-data-accumulation.service";
import { determineLabelForPayment } from "../helper/determine-label-for-payment";
import { PortfolioMovementsResponse } from "../model/portfolio-movements.response";
import { SpecialEventsToTransfersService } from "./special-event-processing/special-events-to-transfers.service";
import { XcmTokenResolutionService } from "./xcm-token-resolution.service";
import { EventEnrichedXcmTransfer } from "../model/event-enriched-xcm-transfer";
import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";
import { PortfolioMovement, TaxableEvent } from "../model/portfolio-movement";
import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { AggregatedStakingReward } from "../model/aggregated-staking-reward";
import { Transaction } from "../../blockchain/substrate/model/transaction";
import { StakingRewardsAggregatorService } from "./staking-rewards-aggregator.service";
import { AddFiatValuesToTaxableEventsService } from "./add-fiat-values-to-taxable-events.service";
import { DataPlatformLiquidStakingService } from "../../data-platform-api/data-platform-liquidstaking.service";

const ignoreIncomingXcm = [
  "assethub-polkadot",
  "assethub-kusama",
  "coretime-polkadot",
  "coretime-kusama",
  "people-polkadot",
  "people-kusama",
  "collectives-polkadot",
  "collectives-kusama",
];

export class PortfolioMovementsService {
  constructor(
    private transactionsService: TransactionsService,
    private subscanService: SubscanService,
    private xcmService: XcmService,
    private stakingRewardsAggregatorService: StakingRewardsAggregatorService,
    private chainDataAccumulationService: ChainDataAccumulationService,
    private specialEventsToTransfersService: SpecialEventsToTransfersService,
    private addFiatValuesToTaxableEventsService: AddFiatValuesToTaxableEventsService,
    private xcmTokenResolutionService: XcmTokenResolutionService,
    private dataPlatformLiquidStakingService: DataPlatformLiquidStakingService,
  ) {}

  private isForEventContextOnly(xcm: XcmTransfer, chain: string): boolean {
    return (
      xcm.transfers.length === 0 ||
      (ignoreIncomingXcm.includes(chain) &&
        xcm.transfers[0].destChain === chain)
    );
  }

  private splitXcmTransfers(
    xcmList: XcmTransfer[],
    chain: string,
  ): { xcmMapToTransfer: XcmTransfer[]; xcmForEventContext: XcmTransfer[] } {
    const xcmMapToTransfer = [];
    const xcmForEventContext = [];

    xcmList.forEach((xcm) => {
      if (this.isForEventContextOnly(xcm, chain)) {
        xcmForEventContext.push(xcm);
      } else {
        xcmMapToTransfer.push(xcm);
      }
    });
    return { xcmMapToTransfer, xcmForEventContext };
  }

  private validate(request: FetchPortfolioMovementsRequest) {
    let { chain } = request;
    if (
      !evmChainConfigs[chain.domain] &&
      !subscanChains.chains.find((p) => p.domain === chain.domain)
    ) {
      throw new HttpError(400, "Chain " + chain.domain + " not found");
    }
  }

  private fetchData(request: FetchPortfolioMovementsRequest) {
    const chainExtendedRequest = {
      ...request,
      chainName: request.chain.domain,
    };
    return Promise.all([
      this.subscanService.fetchAllTransfers(chainExtendedRequest),
      this.transactionsService.fetchTx(chainExtendedRequest),
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
        : [],
    ]);
  }

  private async transform(
    request: FetchPortfolioMovementsRequest,
    transfers: Transfer[],
    transactions: Transaction[],
    events: SubscanEvent[],
    xcmList: XcmTransfer[],
    stakingRewards: {
      rawStakingRewards: StakingReward[];
      aggregatedRewards: AggregatedStakingReward[];
    },
    dataPlatformTransfers: Transfer[],
  ) {
    xcmList = await this.xcmTokenResolutionService.resolveTokens(
      request.chain,
      xcmList,
      events,
    );

    const { xcmMapToTransfer } = this.splitXcmTransfers(
      xcmList,
      request.chain.domain,
    );

    const specialEventTransfers =
      await this.specialEventsToTransfersService.handleEvents(
        request.chain,
        events,
        xcmList,
      );
    transfers.push(...dataPlatformTransfers);
    transfers.push(...specialEventTransfers);

    let { portfolioMovements, unmatchedEvents } =
      await this.chainDataAccumulationService.combine(
        request,
        transactions,
        transfers,
        xcmMapToTransfer as EventEnrichedXcmTransfer[],
        events,
        stakingRewards.rawStakingRewards,
      );

    /**
     * Transactions without asset movements are ignored for now.
     */
    portfolioMovements = portfolioMovements.filter(
      (p) => p.transfers.length > 0,
    );

    portfolioMovements = new ChainAdjustments().handleAdjustments(
      request.chain.domain,
      portfolioMovements,
    );

    return { portfolioMovements, unmatchedEvents };
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
    let [
      transfers,
      transactions,
      events,
      xcmList,
      stakingRewards,
      dataPlatformTransfers,
    ] = await this.fetchData(request);

    const { portfolioMovements, unmatchedEvents } = await this.transform(
      request,
      transfers,
      transactions,
      events,
      xcmList,
      stakingRewards,
      dataPlatformTransfers,
    );

    this.addLabels(request, portfolioMovements);

    const taxableEvents = (portfolioMovements as TaxableEvent[]).concat(
      stakingRewards.aggregatedRewards,
    );

    await this.addFiatValuesToTaxableEventsService.addFiatValues(
      request,
      taxableEvents,
    );

    const sortedTaxableEvents = taxableEvents.sort(
      (a, b) => -a.timestamp + b.timestamp,
    );

    logger.info(
      `PortfolioMovementsService: Exit fetchPortfolioMovements with ${portfolioMovements.length} entries for ${request.chain.domain} and wallet ${request.address}`,
    );
    return { portfolioMovements: sortedTaxableEvents, unmatchedEvents };
  }
}
