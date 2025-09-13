<template>
  <q-page class="q-px-sm q-mx-auto content">
    <div class="q-my-xl" v-if="jobs?.length > 0">
      <q-table
        :rows="jobs"
        :columns="columns"
        :pagination="{ rowsPerPage: 0 }"
        row-key="name"
        data-testid="connected-chains-data-table"
        hide-bottom
      >
        <template v-slot:body="props">
          <q-tr
            :props="props"
            class="clickable-row"
            tabindex="0"
            role="button"
            @click="showTaxableEvents(props.row)"
            @keydown.enter.prevent="showTaxableEvents(props.row)"
            @keydown.space.prevent="showTaxableEvents(props.row)"
          >
            <q-td key="status" :props="props" style="overflow: hidden">
              <q-icon
                :name="matSync"
                size="md"
                class="spinner"
                data-testid="wallet-status-icon"
                v-if="
                  props.row.status === 'in_progress' ||
                  props.row.status === 'pending'
                "
              />
              <q-icon
                :name="matOfflinePin"
                size="md"
                v-if="
                  props.row.status === 'done' && !mayBeIncorrectData(props.row)
                "
              />
              <q-icon
                :name="matWarning"
                size="md"
                color="orange"
                @click.stop
                v-if="
                  props.row.status === 'done' && mayBeIncorrectData(props.row)
                "
              >
                <q-tooltip
                  anchor="top middle"
                  self="bottom middle"
                  aria-label="Error info tooltip"
                  >Actual and calculated asset movement do not align well for
                  tokens:
                  {{ getTokensWithLargeDeviation(props.row) }}</q-tooltip
                >
              </q-icon>
              <q-icon
                :name="matError"
                size="md"
                v-if="props.row.status === 'error'"
                @click.stop
              >
                <q-tooltip
                  anchor="top middle"
                  self="bottom middle"
                  aria-label="Error info tooltip"
                  >{{
                    props.row.error?.msg ??
                    'An error occured when fetching data.'
                  }}</q-tooltip
                ></q-icon
              >
            </q-td>
            <q-td key="wallet" :props="props" class="wallet-cell">
              {{ props.row.wallet.substring(0, 5) + '...' }}
              <q-tooltip aria-label="Full wallet address">{{
                props.row.wallet
              }}</q-tooltip>
            </q-td>
            <q-td key="blockchain" :props="props" class="blockchain-cell">
              {{ getLabelForBlockchain(props.row.blockchain) }}
            </q-td>
            <q-td key="currency" :props="props">
              <q-badge color="green" aria-label="Currency">
                {{ props.row.currency }}
              </q-badge>
            </q-td>
            <q-td key="taxableEventsCount" :props="props">
              {{ getEventCount(props.row) }}
            </q-td>
            <q-td key="timeFrame" :props="props">
              {{ getTimeFrame(props.row) }}
            </q-td>
            <q-td key="lastSynchronized" :props="props">
              {{
                props.row?.lastModified
                  ? formatDate(props.row?.lastModified)
                  : '?'
              }}
            </q-td>
            <q-td key="actions" :props="props">
              <div
                class="text-grey-8 q-gutter-xs"
                v-if="props.row.status === 'error'"
              >
                <q-btn
                  color="secondary"
                  flat
                  @click.stop="retry(props.row)"
                  dense
                  aria-label="Retry synchronization"
                  >Retry</q-btn
                >
              </div>
              <div
                class="text-grey-8 q-gutter-xs"
                v-if="props.row.status === 'done'"
              >
                <q-btn
                  ref="btnRef"
                  size="12px"
                  flat
                  dense
                  round
                  icon="receipt"
                  @click.stop="exportData(props.row)"
                  aria-label="Export as Koinly CSV"
                >
                  <q-tooltip
                    anchor="top middle"
                    self="bottom middle"
                    aria-label="Export as CSV"
                    >CSV export</q-tooltip
                  >
                </q-btn>
              </div>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
    <div v-if="!jobs || jobs.length === 0" class="q-my-xl">
      <div class="text-h6 text-center" role="alert" aria-live="polite">
        {{
          isSynchronizing
            ? 'No taxable events found yet. Synchronization is ongoing.'
            : 'No taxable events found.'
        }}
      </div>
    </div>
    <div class="q-pa-md"></div>
  </q-page>
  <div class="flex justify-center q-pa-md">
    <q-btn
      color="purple"
      label="Synchronizing"
      icon="sync"
      class="icon-spinner synchronizing-btn"
      aria-live="polite"
      aria-atomic="true"
      :aria-hidden="!isSynchronizing"
      tabindex="-1"
    />
  </div>
</template>
<script setup lang="ts">
import { onUnmounted, Ref, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { JobResult } from '../../shared-module/model/job-result';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { formatDate } from '../../shared-module/util/date-utils';
import {
  matSync,
  matOfflinePin,
  matError,
  matWarning,
} from '@quasar/extras/material-icons';
import { useConnectedBlockchainsStore } from '../store/connected-blockchains.store';
import { exportKoinlyCsv } from '../../shared-module/service/export-koinly-csv';

const store = useConnectedBlockchainsStore();
const route = useRoute();
const router = useRouter();

async function exportData(jobResult: JobResult) {
  if (!jobResult.data) {
    return;
  }
  return exportKoinlyCsv(jobResult.data!);
}

const jobs: Ref<JobResult[]> = ref([]);
const chains: Ref<{ domain: string; label: string }[] | undefined> =
  ref(undefined);
const isSynchronizing: Ref<boolean> = ref(true);

store.setCurrency(route.params.currency as string);
store.setWallet(route.params.wallet as string);

const jobsSubscription = store.syncedChains$.subscribe((jobResults) => {
  jobs.value = jobResults;
});

const syncSubscription = store.isSynchronizing$.subscribe((synchronizing) => {
  isSynchronizing.value = synchronizing;
});

const blockchainsSubscription = useSharedStore().subscanChains$.subscribe(
  (subscanChains) => {
    chains.value = subscanChains.chains;
  }
);

onUnmounted(() => {
  jobsSubscription.unsubscribe();
  blockchainsSubscription.unsubscribe();
  syncSubscription.unsubscribe();
});

const columns = ref([
  {
    name: 'status',
    align: 'left',
    label: 'Status',
    sortable: true,
    field: 'status',
  },
  { name: 'wallet', align: 'left', label: 'Wallet' },
  {
    name: 'blockchain',
    align: 'left',
    field: 'chain',
    label: 'Blockchain',
    sortable: true,
  },
  { name: 'currency', label: 'Currency' },
  {
    name: 'taxableEventsCount',
    label: 'Total Taxable Events',
    sortable: true,
    field: (row: JobResult) => getEventCount(row),
  },
  { name: 'timeFrame', label: 'Time Frame' },
  { name: 'lastSynchronized', label: 'Last Synchronized On' },
  { name: 'actions', label: 'Actions' },
]);

function getTimeFrame(row: JobResult) {
  return row?.data?.fromDate
    ? `${row?.data?.fromDate} - ${row?.data?.toDate}`
    : '';
}

function getLabelForBlockchain(domain: string) {
  return !chains.value
    ? domain
    : chains.value.find((c) => c.domain === domain)?.label ?? '';
}

function showTaxableEvents(row: JobResult) {
  router.push(`/wallets/${row.wallet}/${row.currency}/${row.blockchain}`);
}

function getEventCount(jobResult: JobResult) {
  return jobResult.data?.values.length;
}

function retry(job: JobResult) {
  store.retry(job);
}

function mayBeIncorrectData(job: JobResult): boolean {
  return (
    (job.data?.deviations ?? []).filter((d) => d.absoluteDeviationTooLarge)
      .length > 0
  );
}

function getTokensWithLargeDeviation(job: JobResult) {
  return job?.data?.deviations
    .filter((d) => d.absoluteDeviationTooLarge)
    .map((d) => d.symbol)
    .join(', ');
}
</script>
<style lang="scss">
.icon-spinner i {
  animation: spin 2s linear infinite;
  display: inline-block;
  transition: 1s all;
}

.synchronizing-btn {
  cursor: default;
  opacity: 1;
  transition: opacity 0.3s ease;
  position: fixed;
  left: 50%;
  z-index: 1;
  bottom: 150px;
  pointer-events: none;
  transform: translateX(-50%);
}
.synchronizing-btn[aria-hidden='true'] {
  opacity: 0;
}

.wallet-cell,
.blockchain-cell {
  overflow-wrap: anywhere !important;
}

.clickable-row {
  cursor: pointer;
  outline: none;
}
</style>
