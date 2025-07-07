import { SubscanService } from "../api/subscan.service";
import { Transaction } from "../model/transaction";
import { logger } from "../../../logger/logger";
import BigNumber from "bignumber.js";

export class TransactionsService {
  constructor(private subscanService: SubscanService) {}

  async fetchTx(data: {
    chainName: string;
    address: string;
    minDate: number;
    maxDate?: number;
  }): Promise<Transaction[]> {
    logger.info(`Enter fetchTx for ${data.chainName}`);
    const token = await this.subscanService.fetchNativeToken(data.chainName);

    const transactions = await this.subscanService.fetchAllTx(data);

    transactions.forEach((t) => {
      if (t.feeUsed !== undefined) {
        t.feeUsed = BigNumber(t.feeUsed)
          .dividedBy(Math.pow(10, token.token_decimals))
          .toNumber();
      }
      if (t.tip !== undefined) {
        t.tip = BigNumber(t.tip)
          .dividedBy(Math.pow(10, token.token_decimals))
          .toNumber();
      }
    });

    logger.info(`Exit fetchTx for ${data.chainName} with ${transactions.length} transactions.`);
    return transactions;
  }
}
