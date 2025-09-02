import { SubscanApi } from "../api/subscan.api";
import { Block } from "../model/block";
import { logger } from "../../../logger/logger";

export class BlockTimeService {
  constructor(private subscanApi: SubscanApi) {}

  private async searchBlock(
    chainName: string,
    date: number,
    minBlock: Block,
    maxBlock: Block,
    tolerance = 15 * 60 * 1000,
  ): Promise<number> {
    const estimate = this.estimateBlockNum(minBlock, maxBlock, date);
    const currentBlock: Block = await this.subscanApi.fetchBlock(
      chainName,
      estimate,
    );
    if (Math.abs(currentBlock.timestamp - date) > tolerance) {
      if (currentBlock?.timestamp > date) {
        return this.searchBlock(chainName, date, minBlock, currentBlock);
      } else {
        return this.searchBlock(chainName, date, currentBlock, maxBlock);
      }
    }
    return currentBlock.block_num;
  }

  private estimateBlockNum(
    beforeBlock: Block,
    afterBlock: Block,
    date: number,
  ): number {
    const timeDiffRel =
      (date - beforeBlock.timestamp) /
      (afterBlock.timestamp - beforeBlock.timestamp);
    return Math.min(
      afterBlock.block_num,
      Math.max(
        1,
        Math.round(
          beforeBlock.block_num +
            (afterBlock.block_num - beforeBlock.block_num) * timeDiffRel,
        ),
      ),
    );
  }

  async getMinMaxBlock(
    chainName: string,
    minDate: number,
    maxDate?: number,
  ): Promise<{ blockMin: number; blockMax: number }> {
    logger.info(
      `Entry getMinMaxBlock for chain ${chainName} and minDate ${new Date(minDate).toISOString()}, maxDate ${maxDate ? new Date(maxDate).toISOString() : "undefined"}`,
    );
    const firstBlock: Block = await this.subscanApi.fetchBlock(chainName, 1);
    const lastBlock: Block = (
      await this.subscanApi.fetchBlockList(chainName, 0, 1)
    ).list[0];
    const blockMin = await this.searchBlock(
      chainName,
      Math.max(minDate, firstBlock.timestamp),
      firstBlock,
      lastBlock,
    );
    const blockMax = await this.searchBlock(
      chainName,
      Math.min(maxDate || Date.now(), lastBlock.timestamp),
      firstBlock,
      lastBlock,
    );
    logger.info(`Exit getMinMaxBlock for chain ${chainName}`);
    return {
      blockMin: Math.max(1, blockMin),
      blockMax: Math.min(lastBlock.block_num, blockMax),
    };
  }
}
