<template>
  <q-dialog
    :model-value="showDialog"
    @update:model-value="closeDialog"
    persistent
  >
    <q-card>
      <q-card-section>
        <div class="text-h6">Select your Wallet(s)</div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="row">
          <div
            v-for="wallet in walletsWithStatus"
            :key="wallet.id"
            class="col-12 col-sm-6"
          >
            <q-card
              :class="[
                'cursor-pointer flex items-center justify-start q-pa-sm',
                !wallet.installed ? 'text-grey-5 bg-grey-1' : 'hover-card',
              ]"
              flat
              bordered
              @click="selectWallet(wallet)"
            >
              <q-img
                :src="wallet.logo.src"
                :alt="wallet.logo.alt"
                style="width: 48px; height: 48px"
                class="q-mr-sm"
              />
              <div class="column justify-center">
                <div class="text-subtitle1">{{ wallet.title }}</div>
                <div v-if="!wallet.installed" class="text-caption">
                  Not installed
                </div>
              </div>
              <q-icon
                v-if="selectedWallets.find((s: string) => s === wallet.id)"
                name="check_circle"
                color="primary"
                class="q-ml-auto"
              />
            </q-card>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="closeDialog" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, Ref } from 'vue';
import { SUBSTRATE_WALLETS } from './substrate-wallets';
import { useSharedStore } from '../../../shared-module/store/shared.store';

const store = useSharedStore();

const EVM_WALLETS = [
  {
    id: 'metamask',
    title: 'MetaMask',
    logo: {
      src: '/img/wallet-logos/metamask.svg',
      alt: 'MetaMask',
    },
    detect: () =>
      !!(window as any).ethereum && (window as any).ethereum.isMetaMask,
  },
];

interface WalletStatus {
  id: string;
  title: string;
  logo: { src: string; alt: string };
  installed: boolean;
  type: 'substrate' | 'evm';
}

const emit = defineEmits(['update:showDialog']);

defineProps({
  showDialog: Boolean,
});

const selectedWallets: Ref<string[]> = ref([]);

const walletsWithStatus = computed<WalletStatus[]>(() => {
  const injectedWindow = window as any;
  const injectedWallets = injectedWindow.injectedWeb3 || {};

  const substrateWallets: WalletStatus[] = SUBSTRATE_WALLETS.map((wallet) => ({
    id: wallet.extensionName,
    title: wallet.title,
    logo: wallet.logo,
    installed: !!injectedWallets[wallet.extensionName],
    type: 'substrate',
    selected: false,
  }));

  const evmWallets: WalletStatus[] = EVM_WALLETS.map((wallet) => ({
    ...wallet,
    installed: wallet.detect(),
    type: 'evm',
  }));

  return [...substrateWallets, ...evmWallets];
});

async function selectWallet(wallet: WalletStatus) {
  if (selectedWallets.value.find((w) => w === wallet.id)) {
    selectedWallets.value = selectedWallets.value.filter(
      (w) => w !== wallet.id
    );
    return;
  }
  if (!wallet.installed) return;
  wallet.id === 'metamask'
    ? await connectMetaMask()
    : await connectSubstrateWallet(wallet);
  if (!selectedWallets.value.find((w: string) => w === wallet.id)) {
    selectedWallets.value.push(wallet.id);
  }
}

async function connectSubstrateWallet(wallet: WalletStatus) {
  const injectedWallets = (window as any).injectedWeb3 || {};
  const myWallet = injectedWallets[wallet.id];
  await myWallet.enable('Polkatax');
}

async function closeDialog() {
  const accounts = [
    await getEvmWalletAccounts(),
    await getSubstrateAccounts(),
  ].flat();
  selectedWallets.value = [];
  emit('update:showDialog', false);
  store.syncWallets(accounts);
}

async function connectMetaMask() {
  const ethereum = (window as any).ethereum;
  if (!ethereum || !ethereum.isMetaMask) {
    throw new Error('MetaMask is not installed!');
  }
  await ethereum.request({ method: 'eth_requestAccounts' });
}

async function getEvmWalletAccounts(): Promise<string[]> {
  if (!selectedWallets.value.find((w) => w === 'metamask')) {
    return [];
  }
  if ((window as any).ethereum) {
    try {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_accounts',
      });
      if (accounts.length > 0) {
        return accounts;
      } else {
        return [];
      }
    } catch (err) {
      return [];
    }
  } else {
    return [];
  }
}

async function getSubstrateAccounts(): Promise<string[]> {
  const injectedWallets = (window as any).injectedWeb3 || {};
  if (Object.keys(injectedWallets).length === 0) {
    return [];
  } else {
    const accountList = [];
    for (const walletKey of Object.keys(injectedWallets)) {
      if (selectedWallets.value.find((w) => w === walletKey)) {
        const wallet = injectedWallets[walletKey];
        const extension = await wallet.enable('YourAppName');
        const accounts = await extension.accounts.get();
        if (accounts.length > 0) {
          accountList.push(accounts.map((a: any) => a.address));
        }
      }
    }
    return accountList.flat();
  }
}
</script>

<style scoped>
.hover-card:hover {
  background-color: #f5f5f5;
  transition: background-color 0.2s ease;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
