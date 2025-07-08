<template>
  <div class="q-pa-md">
    <q-table
      :rows="rows"
      :columns="columns"
      row-key="hash"
      no-data-label="No rewards found"
      :pagination="initialPagination"
    >
      <template v-slot:top>
        <q-btn
          color="primary"
          class="q-mr-sm"
          @click="exportRewardsAsPdf"
          :disable="noRewards"
          data-testid="pdfExport"
          >Export Pdf
        </q-btn>
        <q-btn
          color="primary"
          class="q-mr-sm"
          @click="exportRewardsAsCsv"
          data-testid="csvExport"
          :disable="noRewards"
          >Export CSV
        </q-btn>
        <q-btn
          color="primary"
          class="q-mr-sm"
          @click="exportRewardsAsKoinlyCsv"
          data-testid="koinlyExport"
          :disable="noRewards"
          >Koinly Export
        </q-btn>
      </template>
    </q-table>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, Ref, ref } from 'vue';
import {
  Reward,
  StakingRewardsPerYear,
} from '../../../../shared-module/model/rewards';
import { useStakingRewardsStore } from '../store/staking-rewards.store';
import {
  formatCurrencyWithoutSymbol,
  formatCryptoAmount,
} from '../../../../shared-module/util/number-formatters';
import { formatDate } from '../../../../shared-module/util/date-utils';
import { exportDefaultCsv } from '../../../../shared-module/service/export-default-csv';
import { exportKoinlyCsv } from '../../../../shared-module/service/export-koinly-csv';

const rewardsStore = useStakingRewardsStore();
const rewards: Ref<StakingRewardsPerYear | undefined> = ref(undefined);

const subscription = rewardsStore.rewardsPerYear$.subscribe(async (r) => {
  rewards.value = r;
});

onUnmounted(() => {
  subscription.unsubscribe();
});

const noRewards = computed(() => {
  return !rewards.value || rewards.value?.values.length === 0;
});

const columns = computed(() => [
  {
    name: 'timestamp',
    required: true,
    label: 'Date',
    align: 'left',
    field: (row: Reward) => formatDate(row.timestamp),
    sortable: true,
  },
  {
    name: 'reward',
    align: 'right',
    label: `Reward (${rewardToken.value})`,
    field: 'amount',
    format: (num: number) => formatCryptoAmount(num),
    sortable: true,
  },
  {
    name: 'price',
    align: 'right',
    label: `Price (${rewards.value?.currency})`,
    field: 'price',
    format: (num: number) => formatCurrencyWithoutSymbol(num),
    sortable: true,
  },
  {
    name: 'fiatValue',
    align: 'right',
    label: `Value (${rewards.value?.currency})`,
    field: 'fiatValue',
    format: (num: number) => formatCurrencyWithoutSymbol(num),
    sortable: true,
  },
]);

const rows = computed(() => rewards.value?.values ?? []);

const rewardToken = computed(() => {
  return rewards.value?.token;
});

const initialPagination = ref({
  sortBy: 'timestamp',
  descending: true,
  page: 1,
  rowsPerPage: 10,
});

function exportRewardsAsCsv() {
  if (!rewards.value) return;
  exportDefaultCsv(rewards.value);
}

function exportRewardsAsKoinlyCsv() {
  if (!rewards.value) return;
  exportKoinlyCsv(rewards.value);
}

async function exportRewardsAsPdf() {
  if (!rewards.value) return;
  // loading exportPdf on demand due to module size.
  const { exportPdf } = await import(
    '../../../../shared-module/service/export-pdf'
  );
  exportPdf(rewards.value);
}
</script>
