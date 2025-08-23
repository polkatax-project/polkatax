import { WalletInfo } from './wallet-info';

export const SUBSTRATE_WALLETS: WalletInfo[] = [
  {
    extensionName: 'subwallet-js',
    title: 'SubWallet',
    logo: {
      src: '/img/wallet-logos/SubWalletLogo.svg',
      alt: 'SubWallet'
    }
  },
  {
    extensionName: 'polkadot-js',
    title: 'Polkadot{.js}',
    logo: {
      src: '/img/wallet-logos/PolkadotLogo.svg',
      alt: 'Polkadot{.js} Extension'
    }
  },
  {
    extensionName: 'talisman',
    title: 'Talisman',
    logo: {
      src: '/img/wallet-logos/TalismanLogo.svg',
      alt: 'Talisman'
    }
  },
  {
    extensionName: 'fearless-wallet',
    title: 'Fearless Wallet',
    logo: {
      src: '/img/wallet-logos/FearlessWalletLogo.svg',
      alt: 'Fearless Wallet Extension'
    }
  },
  {
    extensionName: 'nova-wallet',
    title: 'Nova Wallet',
    installUrl: 'https://novawallet.io',
    logo: {
      alt: 'Nova Wallet'
    }
  }
];
