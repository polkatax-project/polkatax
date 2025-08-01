import dotenv from "dotenv";
import { envFile } from "../../src/server/env.config";
dotenv.config({ path: envFile });
import { StakingRewardsResponse } from "../../src/server/data-aggregation/model/staking-rewards.response";
import { StakingRewardsWithFiatService } from "../../src/server/data-aggregation/services/staking-rewards-with-fiat.service";
import { createDIContainer } from "../../src/server/di-container";
import { StakingReward } from "../../src/server/blockchain/substrate/model/staking-reward";

export const fetchStakingRewards = async (
  address: string,
  chain: string,
  currency = "USD",
  minDate = Date.UTC(2024, 0, 1),
  endDate = Date.UTC(2025, 0, 1),
): Promise<{
  totalAmount: number;
  totalFiat: number;
  rewards: StakingRewardsResponse;
}> => {
  const container = createDIContainer();
  const stakingRewardsWithFiatService: StakingRewardsWithFiatService =
    container.resolve("stakingRewardsWithFiatService");
  let rewards: StakingReward[] =
    await stakingRewardsWithFiatService.fetchStakingRewardsViaSubscan({
      chain: { domain: chain, label: "", token: "" },
      address,
      currency,
      minDate,
    });
  rewards = rewards.filter(
    (v) => v.timestamp >= minDate && v.timestamp <= endDate,
  );
  const totalAmount = rewards.reduce((current, value) => {
    return current + value.amount;
  }, 0);
  const totalFiat = rewards.reduce((current, value) => {
    return current + value.fiatValue;
  }, 0);
  return { totalAmount, totalFiat, rewards: { token: "", values: rewards } };
};
