import { SubscanApi } from "../api/subscan.api";
import { Block } from "../model/block";
import { logger } from "../../../logger/logger";

const MAX_DEPTH = 50;

export class BlockTimeService {
  constructor(private subscanApi: SubscanApi) {}

  private async searchBlock(
    chainName: string,
    date: number,
    minBlock: Block,
    maxBlock: Block,
    tolerance,
    depth = 0,
  ): Promise<number> {
    const estimate = this.estimateBlockNum(minBlock, maxBlock, date);
    if (depth > MAX_DEPTH) {
      logger.info(
        `Exit findBlock: Block for date ${date} on ${chainName} could not be found in ${MAX_DEPTH} steps. Returning: ${estimate}`,
      );
      return estimate;
    }
    const currentBlock: Block = await this.subscanApi.fetchBlock(
      chainName,
      estimate,
    );
    if (Math.abs(currentBlock.timestamp - date) > tolerance) {
      if (currentBlock?.timestamp > date) {
        return this.searchBlock(
          chainName,
          date,
          minBlock,
          currentBlock,
          tolerance,
          depth + 1,
        );
      } else {
        return this.searchBlock(
          chainName,
          date,
          currentBlock,
          maxBlock,
          tolerance,
          depth + 1,
        );
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

  async findBlock(
    chainName: string,
    date: number,
    tolerance: number,
  ): Promise<number> {
    logger.info(
      `Entry findBlock for chain ${chainName} and date ${new Date(date).toISOString()}}`,
    );
    const firstBlock: Block = await this.subscanApi.fetchBlock(chainName, 1);
    const lastBlock: Block = (
      await this.subscanApi.fetchBlockList(chainName, 0, 1)
    ).list[0];
    const block = await this.searchBlock(
      chainName,
      Math.min(lastBlock.timestamp, Math.max(date, firstBlock.timestamp)),
      firstBlock,
      lastBlock,
      tolerance,
    );
    logger.info(`Exit findBlock for chain ${chainName}`);
    return block;
  }
}
