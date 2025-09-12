export interface FetchPortfolioMovementsRequest {
  chain: {
    domain: string;
    label?: string;
    token: string;
  };
  address: string;
  currency: string;
  minDate: number;
  maxDate?: number;
}
