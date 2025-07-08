export interface Reward extends RewardDto {
  timestamp: number;
  valueNow?: number;
  isoDate: string;
}

export interface RewardSummary {
  amount: number;
  fiatValue?: number;
  perYear: { year: number; amount: number; fiatValue?: number }[];
}

export interface DailyRewards {
  [key: string]: { amount: number; fiatValue?: number };
}

export interface Rewards {
  token: string;
  chain: string;
  address: string;
  currency: string;
  summary: RewardSummary;
  values: Reward[];
  dailyValues: DailyRewards;
}

export interface RewardDto {
  timestamp: number;
  amount: number;
  nominationPool?: boolean;
  fiatValue?: number;
  price?: number;
}

export interface RewardsDto {
  values: RewardDto[];
  token: string;
}

export interface StakingRewardsPerYear {
  year: number;
  token: string;
  chain: string;
  address: string;
  currency: string;
  summary: { year: number; amount: number; fiatValue?: number };
  values: Reward[];
  dailyValues: DailyRewards;
}
