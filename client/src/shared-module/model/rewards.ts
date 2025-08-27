export interface RewardSummary {
  amount: number;
  fiatValue?: number;
}

export interface DailyRewards {
  [key: string]: { amount: number; fiatValue?: number };
}

export interface Rewards {
  token: string;
  chain: string;
  address: string;
  currency: string;
  values: RewardDto[];
  summary: RewardSummary;
  dailyValues: DailyRewards;
}

export interface RewardDto {
  timestamp: number;
  amount: number;
  nominationPool?: boolean;
  fiatValue?: number;
  price?: number;
  isoDate?: string;
}

export interface RewardsDto {
  values: RewardDto[];
  token: string;
}
