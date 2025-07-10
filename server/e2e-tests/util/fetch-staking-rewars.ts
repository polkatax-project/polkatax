import dotenv from "dotenv";
import { envFile } from "../../src/server/env.config";
dotenv.config({ path: envFile });
import { StakingRewardsResponse } from "../../src/server/data-aggregation/model/staking-rewards.response";
import { StakingRewardsWithFiatService } from "../../src/server/data-aggregation/services/staking-rewards-with-fiat.service";
import { createDIContainer } from "../../src/server/di-container";

export const fetchStakingRewards = async (
  address: string,
  chain: string,
  currency = "USD",
  startDate = Date.UTC(2024, 0, 1),
  endDate = Date.UTC(2025, 0, 1),
): Promise<{
  totalAmount: number;
  totalFiat: number;
  rewards: StakingRewardsResponse;
}> => {
  const container = createDIContainer();
  const stakingRewardsWithFiatService: StakingRewardsWithFiatService =
    container.resolve("stakingRewardsWithFiatService");
  const rewards: StakingRewardsResponse =
    await stakingRewardsWithFiatService.fetchStakingRewardsViaSubscan({
      chain: { domain: chain, label: "", token: "" },
      address,
      currency,
      startDate,
    });
  rewards.values = rewards.values.filter(
    (v) => v.timestamp >= startDate && v.timestamp <= endDate,
  );
  const totalAmount = rewards.values.reduce((current, value) => {
    return current + value.amount;
  }, 0);
  const totalFiat = rewards.values.reduce((current, value) => {
    return current + value.fiatValue;
  }, 0);
  return { totalAmount, totalFiat, rewards };
};
