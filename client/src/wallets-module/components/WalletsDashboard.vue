<template>
  <q-page class="q-px-sm q-mx-auto content margin-auto">
    <div
      class="q-mt-md q-mb-xl flex justify-center align-center items-center row-xl row-md row-lg row-sm column-xs"
    >
      <q-btn
        color="primary"
        label="Connect Wallet"
        data-testid="submit"
        @click="showWalletSelectionDialog = true"
      />
      <div class="q-mx-md">OR</div>
      <address-input v-model="store.address" @enter-pressed="startSyncing" />
      <q-btn
        color="primary"
        label="Add"
        class="q-ml-lg-xs q-ml-md-xs q-ml-xl-xs q-ml-sm-xs q-mt-xs-xs"
        data-testid="submit"
        @click="startSyncing"
        :disable="isDisabled"
      />
    </div>
    <div class="q-my-md" v-if="wallets && wallets.length > 0">
      <q-table
        :rows="wallets"
        :columns="columns"
        row-key="name"
        table-class="flex"
        class="content"
        hide-bottom
        data-testid="wallet-data-table"
      >
        <template v-slot:body="props">
          <q-tr
            :props="props"
            :style="{ cursor: props.row.walletsWithTxFound ? 'pointer' : '' }"
            @click="navigateToJob(props.row)"
          >
            <q-td key="done" :props="props" style="overflow: hidden">
              <q-icon
                :name="matSync"
                size="md"
                class="spinner"
                data-testid="wallet-status-icon"
                v-if="!props.row.done"
              />
              <q-icon :name="matOfflinePin" size="md" v-if="props.row.done" />
            </q-td>
            <q-td
              key="wallet"
              :props="props"
              style="overflow-wrap: anywhere !important"
              data-testid="wallet-address"
            >
              {{ props.row.wallet }}
              <span @click.stop="clopyToClipboard(props.row.wallet)">📋</span>
            </q-td>
            <q-td key="timeframe" :props="props">
              <q-badge color="purple">
                {{ props.row.timeframe }}
              </q-badge>
            </q-td>
            <q-td key="walletWithTxFound" :props="props">
              <q-badge color="purple">
                {{ props.row.walletsWithTxFound }}
              </q-badge>
            </q-td>
            <q-td key="blockchainsEvaluated" :props="props">
              <q-badge color="purple">
                {{ props.row.blockchainsEvaluated }}
                {{
                  props.row.chainsTotal > 1 ? '/' + props.row.chainsTotal : ''
                }}
              </q-badge>
            </q-td>
            <q-td key="currency" :props="props">
              <q-badge color="green">
                {{ props.row.currency }}
              </q-badge>
            </q-td>
            <q-td key="delete" :props="props">
              <q-btn
                outline
                color="primary"
                icon="delete"
                @click.stop="confirmDelete(props.row)"
              ></q-btn>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
    <div v-if="walletAddresses.length === 0" class="q-my-xl">
      <div class="text-h6 text-center">Export your tax data as CSV or PDF</div>
      <div class="text-h6 text-center q-mt-md">
        A wide range of substrate chains and fiat currencies are supported.
      </div>
      <div class="text-h6 text-center">
        Connect your wallet or enter your wallet address and press submit.
      </div>
      <div class="text-center q-my-md">
        This software comes without warranty. Please verify the exported results
      </div>
      <div class="q-mx-auto text-center">
        <img :src="meme" style="max-width: 40%" />
      </div>
    </div>
    <wallet-selection v-model:show-dialog="showWalletSelectionDialog" />
  </q-page>
</template>

<script setup lang="ts">
import { matSync, matOfflinePin } from '@quasar/extras/material-icons';
import AddressInput from '../../shared-module/components/address-input/AddressInput.vue';
import { computed, onUnmounted, Ref, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { isValidAddress } from '../../shared-module/util/is-valid-address';
import WalletSelection from './wallet-selection/WalletSelection.vue';
import { useQuasar } from 'quasar';
import { JobResult } from '../../shared-module/model/job-result';
import { showMaxWalletsReachedNotif } from '../../shared-module/store/helper/show-max-wallets-reached-notif';

const $q = useQuasar();
const store = useSharedStore();
const router = useRouter();

const wallets: Ref<WalletRow[] | undefined> = ref(undefined);

const walletAddresses: Ref<string[]> = ref([]);
const showWalletSelectionDialog = ref(false);

const walletAddressesSub = store.walletsAddresses$.subscribe(
  (addresses: string[]) => {
    walletAddresses.value = addresses;
  }
);

interface WalletRow {
  wallet: string;
  currency: string;
  done: boolean;
  walletsWithTxFound: boolean;
  blockchainsEvaluated: number;
  chainsTotal: number;
  syncFromDate: number;
  syncUntilDate: number;
  hasErrors: boolean;
}

const jobsSubscription = store.jobs$.subscribe((jobs: JobResult[]) => {
  const r: any[] = [];
  jobs.forEach((j) => {
    const existing = r.find(
      (r) => r.wallet === j.wallet && r.currency === j.currency
    );
    if (!existing) {
      r.push({
        wallet: j.wallet,
        currency: j.currency,
        done: j.status === 'done' || j.status === 'error',
        walletsWithTxFound: j.data?.values?.length ?? 0 > 0 ? 1 : 0,
        blockchainsEvaluated:
          j.status === 'done' || j.status === 'error' ? 1 : 0,
        chainsTotal: jobs.filter((job) => job.wallet === j.wallet).length,
        syncFromDate: j.syncFromDate,
        syncUntilDate: j.syncUntilDate,
        hasErrors: j.error ?? false,
      });
    } else {
      existing.done =
        existing.done && (j.status === 'done' || j.status === 'error');
      if (j.status === 'done' || j.status === 'error') {
        existing.blockchainsEvaluated += 1;
      }
      existing.hasErrors = existing.hasErrors || (j.error ?? false);
      existing.walletsWithTxFound =
        existing.walletsWithTxFound + (j.data?.values?.length ?? 0 > 0 ? 1 : 0);
    }
  });
  wallets.value = r;
});

onUnmounted(() => {
  jobsSubscription.unsubscribe();
  walletAddressesSub.unsubscribe();
});

async function startSyncing() {
  if (!isDisabled.value) {
    const tooManyWallets = await store.sync();
    if (tooManyWallets) {
      showMaxWalletsReachedNotif($q);
    }
  }
}

const isDisabled = computed(() => {
  return !isValidAddress(store.address?.trim());
});

const meme = ref('img/dollar-4932316_1280.jpg');

const columns = ref([
  { name: 'done', label: 'Status', field: 'done', align: 'left' },
  { name: 'wallet', label: 'Wallet', field: 'wallet' },
  { name: 'walletWithTxFound', label: 'Blockchains with transactions found' },
  { name: 'blockchainsEvaluated', label: 'Blockchains evaluated' },
  { name: 'currency', label: 'Currency' },
  { name: 'delete', label: 'Delete' },
]);

function navigateToJob(row: WalletRow) {
  if (row.walletsWithTxFound || row.hasErrors) {
    router.push(`/wallets/${row.wallet}/${row.currency}`);
  }
}

function confirmDelete(job: WalletRow) {
  $q.dialog({
    title: 'Do you want to remove this wallet and its data?',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    store.removeWallet(job);
  });
}

function clopyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  $q.notify({
    position: 'top',
    timeout: 750,
    message: 'Wallet address copied!',
  });
}
</script>
