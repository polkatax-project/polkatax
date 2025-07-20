import { PaymentsRequest } from "../model/payments.request";
import { evmChainConfigs } from "../../blockchain/evm/constants/evm-chains.config";
import { HttpError } from "../../../common/error/HttpError";
import * as subscanChains from "../../../../res/gen/subscan-chains.json";
import { logger } from "../../logger/logger";
import { XcmService } from "../../blockchain/substrate/services/xcm.service";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { TransactionsService } from "../../blockchain/substrate/services/transactions.service";
import { ChainAdjustments } from "../helper/chain-adjustments";
import { StakingRewardsService } from "../../blockchain/substrate/services/staking-rewards.service";
import { AddFiatValuesToPaymentsService } from "./add-fiat-values-to-payments.service";
import { ChainDataAccumulationService } from "./chain-data-accumulation.service";
import { determineLabelForPayment } from "../helper/determine-label-for-payment";
import { PaymentsResponse } from "../model/payments.response";
import { SpecialEventsToTransfersService } from "./special-events-to-transfers.service";
import { XcmTokenResolutionService } from "./xcm-token-resolution.service";

export class PaymentsService {
  constructor(
    private transactionsService: TransactionsService,
    private subscanService: SubscanService,
    private xcmService: XcmService,
    private stakingRewardsService: StakingRewardsService,
    private chainDataAccumulationService: ChainDataAccumulationService,
    private specialEventsToTransfersService: SpecialEventsToTransfersService,
    private addFiatValuesToPaymentsService: AddFiatValuesToPaymentsService,
    private xcmTokenResolutionService: XcmTokenResolutionService
  ) {}

  private validate(paymentsRequest: PaymentsRequest) {
    let { chain } = paymentsRequest;
    if (
      !evmChainConfigs[chain.domain] &&
      !subscanChains.chains.find((p) => p.domain === chain.domain)
    ) {
      throw new HttpError(400, "Chain " + chain.domain + " not found");
    }
  }

  async fetchPaymentsTxAndEvents(
    paymentsRequest: PaymentsRequest,
  ): Promise<PaymentsResponse> {
    logger.info(
      `PaymentsService: Enter fetchPaymentsTxAndEvents for ${paymentsRequest.chain.domain} and wallet ${paymentsRequest.address}`,
    );
    this.validate(paymentsRequest);
    const dataRequest = {
      ...paymentsRequest,
      chainName: paymentsRequest.chain.domain,
    };
    const [transfers, transactions, events, xcmList, stakingRewards] =
      await Promise.all([
        this.subscanService.fetchAllTransfers(dataRequest),
        this.transactionsService.fetchTx(dataRequest),
        this.subscanService.searchAllEvents(dataRequest),
        this.xcmService.fetchXcmTransfers(dataRequest),
        this.stakingRewardsService.fetchStakingRewards(dataRequest),
      ]);

    const eventEnrichedXcmTransfers = await this.xcmTokenResolutionService.resolveTokens(paymentsRequest.chain, xcmList, events)

    const specialEventTransfers =
      await this.specialEventsToTransfersService.handleEvents(
        paymentsRequest.chain,
        events,
      );
    transfers.push(...specialEventTransfers);

    const { payments, unmatchedEvents } =
      await this.chainDataAccumulationService.combine(
        paymentsRequest,
        transactions,
        transfers,
        eventEnrichedXcmTransfers,
        events,
        stakingRewards,
      );

    if (paymentsRequest.chain.domain === "hydration") {
      new ChainAdjustments().handleHydration(payments);
    }

    await this.addFiatValuesToPaymentsService.addFiatValues(
      paymentsRequest,
      payments,
    );

    const paymentsSorted = payments.sort((a, b) => -a.timestamp + b.timestamp);

    paymentsSorted.forEach(
      (p) =>
        (p.label = determineLabelForPayment(paymentsRequest.chain.domain, p)),
    );

    logger.info(
      `PaymentsService: Exit fetchPaymentsTxAndEvents with ${payments.length} entries for ${paymentsRequest.chain.domain} and wallet ${paymentsRequest.address}`,
    );
    return { payments, unmatchedEvents };
  }
}
