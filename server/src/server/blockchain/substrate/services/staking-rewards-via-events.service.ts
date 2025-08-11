import { SubscanService } from "../api/subscan.service";
import { StakingReward } from "../model/staking-reward";
import { SubscanEvent } from "../model/subscan-event";

export class StakingRewardsViaEventsService {
  constructor(private subscanService: SubscanService) {}

  async fetchStakingRewards(
    chainName,
    address,
    module,
    event_id,
    minDate: number,
    maxDate?: number,
  ): Promise<StakingReward[]> {
    const events = await this.subscanService.searchAllEvents({
      chainName,
      address,
      module,
      event_id,
      minDate,
      maxDate,
    });
    const transfers = await this.subscanService.fetchAllTransfers({
      chainName,
      address,
      minDate,
      maxDate,
    });
    const hashMap = new Map<string, SubscanEvent>();
    events.forEach((e) => hashMap.set(e.extrinsic_hash, e));
    return transfers
      .filter((transfer) => hashMap.get(transfer.hash))
      .map((transfer) => {
        return {
          event_id: transfer.amount < 0 ? "Slash" : "Reward",
          amount: transfer.amount,
          timestamp: transfer.timestamp,
          block: transfer.block,
          hash: transfer.hash,
          event_index: hashMap.get(transfer.hash).event_index,
          extrinsic_index: transfer.extrinsic_index,
          fiatValue: transfer.fiatValue,
          price: transfer.price,
          asset_unique_id: transfer.asset_unique_id,
        };
      });
  }
}
