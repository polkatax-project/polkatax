export interface Transaction {
  id?: string;
  hash: string;
  from: string;
  to?: string;
  timestamp: number;
  block?: number;
  callModule?: string;
  callModuleFunction?: string;
  amount: number;
  feeUsed?: number;
  tip?: number;
  extrinsic_index: string;
}
