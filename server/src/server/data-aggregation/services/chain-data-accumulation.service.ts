import { IndexedPayments, TransferMerger } from "../helper/transfer-merger";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { isEvmAddress } from "../helper/is-evm-address";
import { SubscanEvent } from "../../blockchain/substrate/model/subscan-event";
import { Payment } from "../model/payment";
import { StakingReward } from "../../blockchain/substrate/model/staking-reward";
import { Transaction } from "../../blockchain/substrate/model/transaction";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { EventEnrichedXcmTransfer } from "../model/EventEnrichedXcmTransfer";
import { logger } from "../../logger/logger";
import { XcmTransfer } from "../../blockchain/substrate/model/xcm-transfer";

export class ChainDataAccumulationService {
  constructor(
    private transferMerger: TransferMerger,
    private subscanService: SubscanService,
  ) {}

  async combine(
    context: { address: string; chain: { domain: string; token: string } },
    transactions: Transaction[],
    transfersList: Transfer[],
    xcmList: EventEnrichedXcmTransfer[],
    events: SubscanEvent[],
    stakingRewards: StakingReward[],
  ): Promise<{ payments: Payment[]; unmatchedEvents: SubscanEvent[] }> {
    logger.info("Entry ChainDataAccumulationService.combine");
    const aliases = isEvmAddress(context.address)
      ? [
          await this.subscanService.mapToSubstrateAccount(
            context.chain.domain,
            context.address,
          ),
        ]
      : await this.subscanService.fetchAccounts(
          context.address,
          context.chain.domain,
        );

    const indexedPayments: IndexedPayments = this.transferMerger.mergeTranfers(
      transfersList,
      context.address,
      aliases,
    );

    const extrinsicIndexedEvents: Record<string, SubscanEvent[]> =
      events.reduce((current, event) => {
        current[event.extrinsic_index] ??= [];
        current[event.extrinsic_index].push(event);
        return current;
      }, {});
    // not all events have an extrinsic_index, hence we need to index via hash as well.
    const hashIndexedEvents: Record<string, SubscanEvent[]> = events.reduce(
      (current, event) => {
        current[event.extrinsic_hash] ??= [];
        current[event.extrinsic_hash].push(event);
        return current;
      },
      {},
    );
    const indexedTx: Record<string, Transaction> = transactions.reduce(
      (current, tx) => {
        if (!tx.extrinsic_index) {
          throw "All tx need extrinsic_index";
        }
        current[tx.extrinsic_index] = tx;
        return current;
      },
      {},
    );

    this.enrichTransfers(
      indexedPayments,
      indexedTx,
      extrinsicIndexedEvents,
      hashIndexedEvents,
    );

    const xcmPayments = this.enrichXcmTransfers(context.chain.domain, xcmList, indexedTx);
    for (let xcmPayment of xcmPayments) {
      if (!indexedPayments[xcmPayment.extrinsic_index]) {
        indexedPayments[xcmPayment.extrinsic_index] = xcmPayment;
      } else {
        xcmPayment.transfers
          .filter((t) => {
            // avoiding duplicates
            return !indexedPayments[xcmPayment.extrinsic_index].transfers.some(
              (other) => other.amount === t.amount && other.symbol === t.symbol,
            );
          })
          .forEach((t) => {
            indexedPayments[xcmPayment.extrinsic_index].transfers.push(t);
          });
      }
    }

    const stakingRewardPayments = this.enrichStakingRewards(
      stakingRewards,
      context.chain.token,
      indexedTx,
      context.address,
      extrinsicIndexedEvents,
    );
    const indexedStakingRewards: Record<string, Payment[]> =
      stakingRewardPayments.reduce((current, stakingRewards) => {
        current[stakingRewards.extrinsic_index] ??= [];
        current[stakingRewards.extrinsic_index].push(stakingRewards);
        return current;
      }, {});

    /**
     * TODO: how to avoid duplicated (reward/transfer)?
     */
    Object.keys(indexedStakingRewards).forEach((extrinsic_index) => {
      if (!indexedPayments[extrinsic_index]) {
        indexedPayments[extrinsic_index] = {
          ...indexedStakingRewards[extrinsic_index][0],
          transfers: [],
        };
      }
      indexedStakingRewards[extrinsic_index].forEach((r) =>
        r.transfers.forEach((t) => {
          indexedPayments[extrinsic_index].transfers.push(t);
        }),
      );
    });

    const otherTransactions = this.enrichTxWithEvents(
      transactions.filter((t) => !indexedPayments[t.extrinsic_index]),
      extrinsicIndexedEvents,
      hashIndexedEvents,
    );

    otherTransactions.forEach((tx) => {
      indexedPayments[tx.extrinsic_index] = {
        ...tx,
        provenance: "tx",
        transfers: [],
      };
    });

    const unmatchedEvents = this.findUnmatchedEvents(events, indexedPayments);
    logger.info("Exit ChainDataAccumulationService.combine");
    return { payments: Object.values(indexedPayments), unmatchedEvents };
  }

  private enrichStakingRewards(
    stakingRewards: StakingReward[],
    stakingRewardsToken: string,
    indexedTx: Record<string, Transaction>,
    walletAddress: string,
    indexedEvents: Record<string, SubscanEvent[]>,
  ): Payment[] {
    return (stakingRewards || []).map((stakingReward) => {
      const matchingTx = indexedTx[stakingReward.extrinsic_index];
      return {
        hash: stakingReward.hash,
        block: stakingReward.block,
        timestamp: stakingReward.timestamp,
        extrinsic_index: stakingReward.extrinsic_index,
        events:
          indexedEvents[stakingReward.extrinsic_index]?.map((e) => ({
            moduleId: e.module_id,
            eventId: e.event_id,
            eventIndex: e.event_index,
          })) ?? [],
        feeUsed: matchingTx?.feeUsed,
        tip: matchingTx?.tip,
        provenance: "stakingRewards",
        transfers: [
          {
            provenance: "stakingReward",
            symbol: stakingRewardsToken,
            amount: stakingReward.amount,
            from: undefined,
            to: walletAddress,
            extrinsic_index: stakingReward.extrinsic_index,
            price: stakingReward.price,
            fiatValue: stakingReward.fiatValue,
            asset_unique_id: stakingReward.asset_unique_id,
          },
        ],
      };
    });
  }

  private findUnmatchedEvents(
    events: SubscanEvent[],
    indexedPayments: IndexedPayments,
  ): SubscanEvent[] {
    const hashes = {};
    Object.values(indexedPayments)
      .filter((p) => p.hash && !hashes[p.hash])
      .forEach((p) => (hashes[p.hash] = true));
    return events.filter((e) => {
      if (e.extrinsic_hash && hashes[e.extrinsic_hash]) {
        return false;
      }
      if (e.extrinsic_index && indexedPayments[e.extrinsic_index]) {
        return false;
      }
      return true;
    });
  }

  private enrichTxWithEvents(
    transactions: Transaction[],
    extrinsicIndexedEvents: Record<string, SubscanEvent[]>,
    hashIndexedEvents: Record<string, SubscanEvent[]>,
  ): Payment[] {
    const result: Payment[] = [];
    transactions.forEach((tx) => {
      const enrichedTx: Payment = {
        ...tx,
        provenance: "tx",
        events: [],
        transfers: [],
      };
      const extrinsic_index = tx.extrinsic_index;
      const hash = tx.hash;
      if (extrinsicIndexedEvents[extrinsic_index]) {
        extrinsicIndexedEvents[extrinsic_index].forEach((event) => {
          enrichedTx.events.push({
            moduleId: event.module_id,
            eventId: event.event_id,
            eventIndex: event.event_index,
          });
        });
      } else if (hash && hashIndexedEvents[hash]) {
        hashIndexedEvents[hash].forEach((event) => {
          enrichedTx.events.push({
            moduleId: event.module_id,
            eventId: event.event_id,
            eventIndex: event.event_index,
          });
        });
      }
      result.push(enrichedTx);
    });
    return result;
  }

  private enrichTransfers(
    indexedPayments: IndexedPayments,
    indexedTx: Record<string, Transaction>,
    extrinsicIndexedEvents: Record<string, SubscanEvent[]>,
    hashIndexedEvents: Record<string, SubscanEvent[]>,
  ): void {
    Object.keys(indexedPayments).forEach((key) => {
      const transfers = indexedPayments[key];
      const hash = indexedPayments[key].hash;
      transfers.provenance = "transfer";
      if (extrinsicIndexedEvents[key]) {
        extrinsicIndexedEvents[key].forEach((event) => {
          transfers.events.push({
            moduleId: event.module_id,
            eventId: event.event_id,
            eventIndex: event.event_index,
          });
        });
      } else if (hashIndexedEvents[hash]) {
        hashIndexedEvents[hash].forEach((event) => {
          transfers.events.push({
            moduleId: event.module_id,
            eventId: event.event_id,
            eventIndex: event.event_index,
          });
        });
      }
      if (indexedTx[key]) {
        transfers.callModule = indexedTx[key].callModule;
        transfers.callModuleFunction = indexedTx[key].callModuleFunction;
        transfers.tip = indexedTx[key].tip;
        transfers.feeUsed = indexedTx[key].feeUsed;
        transfers.hash = indexedTx[key].hash;
        transfers.block = indexedTx[key].block;
      }
    });
  }

  private enrichXcmTransfers(
    chainName: string,
    xcmTransfers: EventEnrichedXcmTransfer[],
    indexedTx: Record<string, Transaction>,
  ): Payment[] {
    const xcmWithoutSender: XcmTransfer[] = []
    const payments: Payment[] = [];
    xcmTransfers.forEach((xcmTransfer) => {
      const tx = xcmTransfer.extrinsic_index
        ? indexedTx[xcmTransfer.extrinsic_index]
        : undefined;
      xcmTransfer.transfers.filter(t => !t.from && t.fromChain === chainName).forEach(t => {
        t.from = tx.from
      })
      if (xcmTransfer.transfers.some(t => !t.from && t.fromChain === chainName)) {
        xcmWithoutSender.push(xcmTransfer)
      } else {
        payments.push({
          ...xcmTransfer,
          provenance: "xcm",
          xcmFee: xcmTransfer.fee,
          extrinsic_index: tx?.extrinsic_index ?? xcmTransfer.extrinsic_index,
          tip: tx?.tip ?? 0,
          feeUsed: tx?.feeUsed ?? 0,
          hash: tx?.hash,
        });
      }
    });
    return payments;
  }
}
