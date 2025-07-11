<template>
  <q-page class="q-px-sm q-mx-auto content margin-auto">
    <div class="q-my-md flex justify-center align-center items-center row">
      <address-input v-model="store.address" @enter-pressed="startSyncing" />
      <q-btn
        color="primary"
        label="Add"
        data-testid="submit"
        class="q-mt-md q-mb-xl"
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
            style="cursor: pointer"
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
      <div class="text-h6 text-center">
        Export your staking rewards as CSV or PDF
      </div>
      <div class="text-h6 text-center q-mt-md">
        A wide range of substrate chains and fiat currencies are supported.
      </div>
      <div class="text-h6 text-center">
        Enter your wallet address and press submit.
      </div>
      <div class="text-center q-my-md">
        This program returns the staking rewards earned as nominator. This
        software comes without warranty. Please verify the exported results
      </div>
      <div class="q-mx-auto text-center">
        <img :src="meme" style="max-width: 40%" />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { matSync, matOfflinePin } from '@quasar/extras/material-icons';
import AddressInput from '../../shared-module/components/address-input/AddressInput.vue';
import { computed, onUnmounted, Ref, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { isValidAddress } from '../../shared-module/util/is-valid-address';
import { useQuasar } from 'quasar';
import { JobResult } from '../../shared-module/model/job-result';
const $q = useQuasar();
const store = useSharedStore();
const router = useRouter();

const wallets: Ref<
  | { wallet: string; currency: string; done: boolean; walletsWithTx: number }[]
  | undefined
> = ref(undefined);

const walletAddresses: Ref<string[]> = ref([]);

const walletAddressesSub = store.walletsAddresses$.subscribe((addresses) => {
  walletAddresses.value = addresses;
});

const jobsSubscription = store.jobs$.subscribe((jobs) => {
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
        walletsWithTxFound: j.data?.values?.length > 0 ? 1 : 0,
      });
    } else {
      existing.done =
        existing.done && (j.status === 'done' || j.status === 'error');
      existing.walletsWithTxFound =
        existing.walletsWithTxFound + (j.data?.values?.length > 0 ? 1 : 0);
    }
  });
  wallets.value = r;
});

onUnmounted(() => {
  jobsSubscription.unsubscribe();
  walletAddressesSub.unsubscribe();
});

function startSyncing() {
  if (!isDisabled.value) {
    store.sync();
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
  { name: 'currency', label: 'Currency' },
  { name: 'delete', label: 'Delete' },
]);

function navigateToJob(job: any) {
  router.push(`/wallets/${job.wallet}/${job.currency}`);
}

function confirmDelete(job: JobResult) {
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
