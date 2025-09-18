export interface SubstrateChain {
  domain: string;
  label: string;
  stakingPallets: string[];
  evm: boolean;
  token: string;
  excluded: boolean;
}

export interface SubstrateChains {
  chains: SubstrateChain[];
}
