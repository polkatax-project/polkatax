import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import { logger } from "../../logger/logger";
import { Payment } from "../model/payment";

export interface IndexedPayments {
  [key: string]: Payment;
}

export class TransferMerger {
  private merge(
    target: IndexedPayments,
    address: string,
    transferList: Transfer[],
    isMyAccount: (acc: string) => boolean,
  ): void {
    let key = undefined;
    transferList.forEach((entry) => {
      key ??= entry.extrinsic_index;
      const otherAddress = isMyAccount(entry.from) ? entry.to : entry.from;
      if (!target[key]) {
        target[key] = {
          transfers: [],
          events: [],
          hash: entry.hash,
          extrinsic_index: entry.extrinsic_index,
          block: entry.block,
          timestamp: entry.timestamp,
        };
      }
      let matchingTransfer = target[key].transfers.find(
        (t) => t.tokenId === entry.tokenId,
      );
      if (!matchingTransfer) {
        matchingTransfer = {
          ...entry,
          amount: 0,
          fiatValue: 0,
        };
        target[key].transfers.push(matchingTransfer);
      }
      if (isMyAccount(entry.to)) {
        matchingTransfer.amount += Number(entry.amount);
        matchingTransfer.fiatValue += entry.fiatValue;
      } else if (isMyAccount(entry.from)) {
        matchingTransfer.amount -= Number(entry.amount);
        matchingTransfer.fiatValue -= entry.fiatValue;
      } else {
        logger.warn("no match for transfer!");
      }
      if (matchingTransfer.amount > 0) {
        matchingTransfer.to = address;
        matchingTransfer.from = otherAddress;
      } else {
        matchingTransfer.from = address;
        matchingTransfer.to = otherAddress;
      }
    });
    if (target[key]?.transfers) {
      target[key].transfers = target[key]?.transfers.filter(
        (t) => t.amount !== 0,
      );
    }
  }

  mergeTranfers(
    transferList: Transfer[],
    address: string,
    aliases: string[],
  ): IndexedPayments {
    const isMyAccount = (addressToTest: string) =>
      address.toLowerCase() === addressToTest.toLowerCase() ||
      aliases.indexOf(addressToTest) > -1;

    transferList = transferList.filter((t) => {
      if (!t.extrinsic_index) {
        logger.warn(
          `Transfer without extrinsic_index found: block ${t.block}, timestamp ${t.timestamp}. Skipping transfer`,
        );
        return false;
      }
      return true;
    });

    const indexedTransfers: Record<string, Transfer[]> = {};
    for (let transfer of transferList) {
      if (!indexedTransfers[transfer.extrinsic_index]) {
        indexedTransfers[transfer.extrinsic_index] = [];
      }
      indexedTransfers[transfer.extrinsic_index].push(transfer);
    }

    const mergedTransfers: IndexedPayments = {};
    Object.keys(indexedTransfers).forEach((key: string) => {
      this.merge(mergedTransfers, address, indexedTransfers[key], isMyAccount);
    });

    return mergedTransfers;
  }
}
