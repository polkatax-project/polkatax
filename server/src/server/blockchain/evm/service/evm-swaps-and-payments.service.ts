import { EvmTxService } from "./evm-tx.service";
import { logger } from "../../../logger/logger";
import { EVMTransfer, EVMTx } from "../model/transfers";
import { Transaction } from "../../substrate/model/transaction";
import { Transfer } from "../../substrate/model/raw-transfer";
import BigNumber from "bignumber.js";

export class EvmSwapsAndPaymentsService {
  constructor(private evmTxService: EvmTxService) {}

  private mapEvmTransferToTransferDto(evmTransfer: EVMTransfer): Transfer {
    return {
      symbol: evmTransfer.tokenSymbol,
      amount: Number(
        new BigNumber(evmTransfer.value).dividedBy(
          Math.pow(10, Number(evmTransfer.tokenDecimal)),
        ),
      ),
      from: evmTransfer.from,
      to: evmTransfer.to,
      block: Number(evmTransfer.blockNumber),
      timestamp: Number(evmTransfer.timeStamp),
      hash: evmTransfer.hash,
      asset_unique_id: evmTransfer.contractAddress,
    };
  }

  private mapEvmTxToTransaction(tx: EVMTx): Transaction {
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      timestamp: Number(tx.timeStamp),
      block: Number(tx.blockNumber),
      callModuleFunction: tx.functionName,
      callModule: tx.functionName, // TODO: what value corresponds to functionName of substrate tx?
      extrinsic_index: tx.hash,
      amount: Number(
        new BigNumber(tx.value).dividedBy(Math.pow(10, Number(18))),
      ),
    };
  }

  async fetchSwapsAndPayments(data: {
    chainName;
    address: string;
    minDate: number;
    maxDate?: number;
  }): Promise<{ transactions: Transaction[]; transfersList: Transfer[] }> {
    logger.info(`Enter fetchSwapsAndPayments for ${data.chainName}`);
    const { tx, transfers } = await this.evmTxService.fetchTxAndTransfers(
      data.chainName,
      data.address,
      new Date(data.minDate),
      data.maxDate ? new Date(data.maxDate) : undefined,
    );
    logger.info(`Exit fetchSwapsAndPayments for ${data.chainName}`);
    return {
      transactions: tx.map((tx) => this.mapEvmTxToTransaction(tx)),
      transfersList: transfers.map((t) => this.mapEvmTransferToTransferDto(t)),
    };
  }
}
