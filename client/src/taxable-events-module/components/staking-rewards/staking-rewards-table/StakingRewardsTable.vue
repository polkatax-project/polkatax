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
          class="q-mr-sm q-mb-xs"
          @click="exportRewardsAsPdf"
          :disable="noRewards"
          data-testid="pdfExport"
          >Pdf Export
        </q-btn>
        <q-btn
          color="primary"
          class="q-mr-sm q-mb-xs"
          @click="exportRewardsAsKoinlyCsv"
          data-testid="koinlyExport"
          :disable="noRewards"
          >CVS Export
        </q-btn>
      </template>
    </q-table>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, Ref, ref } from 'vue';
import {
  formatCurrencyWithoutSymbol,
  formatCryptoAmount,
} from '../../../../shared-module/util/number-formatters';
import { useTaxableEventStore } from '../../../store/taxable-events.store';
import { RewardDto, Rewards } from '../../../../shared-module/model/rewards';
import { stakingExportKoinlyCsv } from '../../../../shared-module/service/staking-export-koinly-csv';

const rewardsStore = useTaxableEventStore();
const rewards: Ref<Rewards | undefined> = ref(undefined);

const subscription = rewardsStore.stakingRewards$.subscribe(async (r) => {
  rewards.value = r;
});

onUnmounted(() => {
  subscription.unsubscribe();
});

const noRewards = computed(() => {
  return !rewards.value || rewards.value.values.length === 0;
});

const columns = computed(() => [
  {
    name: 'timestamp',
    required: true,
    label: 'Date',
    align: 'left',
    field: (row: RewardDto) => row.isoDate,
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

function exportRewardsAsKoinlyCsv() {
  if (!rewards.value) return;
  stakingExportKoinlyCsv(rewards.value);
}

async function exportRewardsAsPdf() {
  if (!rewards.value) return;
  // loading exportPdf on demand due to module size.
  const { stakingExportPdf } = await import(
    '../../../../shared-module/service/staking-export-pdf'
  );
  stakingExportPdf(rewards.value);
}
</script>
