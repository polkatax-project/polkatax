import { FetchPortfolioMovementsRequest } from "../model/fetch-portfolio-movements.request";
import { evmChainConfigs } from "../../blockchain/evm/constants/evm-chains.config";
import { HttpError } from "../../../common/error/HttpError";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import { logger } from "../../logger/logger";
import { XcmService } from "../../blockchain/substrate/services/xcm.service";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { TransactionsService } from "../../blockchain/substrate/services/transactions.service";
import { ChainAdjustments } from "../helper/chain-adjustments";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { AddFiatValuesToPortfolioMovementsService } from "./add-fiat-values-to-portfolio-movements.service";
import { ChainDataAccumulationService } from "./chain-data-accumulation.service";
import { determineLabelForPayment } from "../helper/determine-label-for-payment";
import { PortfolioMovementsResponse } from "../model/portfolio-movements.response";
import { SpecialEventsToTransfersService } from "./special-events-to-transfers.service";
import { XcmTokenResolutionService } from "./xcm-token-resolution.service";
import { EventEnrichedXcmTransfer } from "../model/EventEnrichedXcmTransfer";
import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";

const ignoreIncomingXcm = [
  "hydration",
  "basilisk",
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
    private stakingRewardsService: StakingRewardsService,
    private chainDataAccumulationService: ChainDataAccumulationService,
    private specialEventsToTransfersService: SpecialEventsToTransfersService,
    private addFiatValuesToPortfolioMovementsService: AddFiatValuesToPortfolioMovementsService,
    private xcmTokenResolutionService: XcmTokenResolutionService,
  ) {}

  private slitXcmTransfers(
    xcmList: XcmTransfer[],
    chain: string,
  ): { xcmMapToTransfer: XcmTransfer[]; xcmForEventContext: XcmTransfer[] } {
    const xcmMapToTransfer = [];
    const xcmForEventContext = [];

    const isForEventContextOnly = (xcm: XcmTransfer, chain: string) => {
      if (xcm.transfers.length === 0) {
        return true;
      }
      if (ignoreIncomingXcm.includes(chain)) {
        if (xcm.transfers[0].destChain === chain) {
          return true;
        }
      }
      return false;
    };
    xcmList.forEach((xcm) => {
      if (isForEventContextOnly(xcm, chain)) {
        xcmForEventContext.push(xcm);
      } else {
        xcmMapToTransfer.push(xcm);
      }
    });
    return { xcmMapToTransfer, xcmForEventContext };
  }

  private validate(paymentsRequest: FetchPortfolioMovementsRequest) {
    let { chain } = paymentsRequest;
    if (
      !evmChainConfigs[chain.domain] &&
      !subscanChains.chains.find((p) => p.domain === chain.domain)
    ) {
      throw new HttpError(400, "Chain " + chain.domain + " not found");
    }
  }

  async fetchPortfolioMovements(
    paymentsRequest: FetchPortfolioMovementsRequest,
  ): Promise<PortfolioMovementsResponse> {
    logger.info(
      `PortfolioMovementsService: Enter fetchPortfolioMovements for ${paymentsRequest.chain.domain} and wallet ${paymentsRequest.address}`,
    );
    this.validate(paymentsRequest);
    const dataRequest = {
      ...paymentsRequest,
      chainName: paymentsRequest.chain.domain,
    };
    let [transfers, transactions, events, xcmList, stakingRewards] =
      await Promise.all([
        this.subscanService.fetchAllTransfers(dataRequest),
        this.transactionsService.fetchTx(dataRequest),
        this.subscanService.searchAllEvents(dataRequest),
        this.xcmService.fetchXcmTransfers(dataRequest),
        this.stakingRewardsService.fetchStakingRewards(dataRequest),
      ]);

    xcmList = await this.xcmTokenResolutionService.resolveTokens(
      paymentsRequest.chain,
      xcmList,
      events,
    );

    const { xcmMapToTransfer, xcmForEventContext } = this.slitXcmTransfers(
      xcmList,
      paymentsRequest.chain.domain,
    );

    const specialEventTransfers =
      await this.specialEventsToTransfersService.handleEvents(
        paymentsRequest.chain,
        events,
        xcmForEventContext,
      );
    transfers.push(...specialEventTransfers);

    const { portfolioMovements, unmatchedEvents } =
      await this.chainDataAccumulationService.combine(
        paymentsRequest,
        transactions,
        transfers,
        xcmMapToTransfer as EventEnrichedXcmTransfer[],
        events,
        stakingRewards,
      );

    if (paymentsRequest.chain.domain === "hydration") {
      new ChainAdjustments().handleHydration(portfolioMovements);
    }

    await this.addFiatValuesToPortfolioMovementsService.addFiatValues(
      paymentsRequest,
      portfolioMovements,
    );

    const paymentsSorted = portfolioMovements.sort(
      (a, b) => -a.timestamp + b.timestamp,
    );

    paymentsSorted.forEach(
      (p) =>
        (p.label = determineLabelForPayment(paymentsRequest.chain.domain, p)),
    );

    logger.info(
      `PortfolioMovementsService: Exit fetchPortfolioMovements with ${portfolioMovements.length} entries for ${paymentsRequest.chain.domain} and wallet ${paymentsRequest.address}`,
    );
    return { portfolioMovements, unmatchedEvents };
  }
}
