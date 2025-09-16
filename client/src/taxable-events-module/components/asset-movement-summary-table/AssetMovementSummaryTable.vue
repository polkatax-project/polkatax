<template>
  <div class="q-pa-md q-mx-auto content">
    <q-table
      title="Asset transfers summary"
      :rows="rows"
      :columns="columns"
      row-key="id"
      :pagination="{ rowsPerPage: 20 }"
      no-data-label="No data found"
    >
    </q-table>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { TaxData } from '../../../shared-module/model/tax-data';
import {
  formatCryptoAmount,
} from '../../../shared-module/util/number-formatters';

const store = useTaxableEventStore();
const taxData: Ref<TaxData | undefined> = ref(undefined);
const excludedPaymentIds: Ref<number[]> = ref([]);

const taxDataSubscription = store.visibleTaxData$.subscribe(async (data) => {
  taxData.value = data;
});

const excludedEntriesSubscription = store.excludedEntries$.subscribe(
  async (data) => {
    excludedPaymentIds.value = data.map((d) => d.id!);
  }
);

onUnmounted(() => {
  taxDataSubscription.unsubscribe();
  excludedEntriesSubscription.unsubscribe();
});

interface SummaryItem {
  symbol: string;
  sentAmount: number;
  receivedAmount: number;
  fiatValueReceived: number;
  fiatValueSent: number;
}

const rows = computed(() => {
  const tokenSummary: Record<
    string,
    {
      sentAmount: number;
      receivedAmount: number;
      fiatValueReceived: number;
      fiatValueSent: number;
    }
  > = {};
  taxData.value?.values
    .filter((e) => !excludedPaymentIds.value.includes(e.id!))
    .forEach((v) => {
      v.transfers.forEach((t) => {
        const symbol = t.symbol.toUpperCase();
        if (!tokenSummary[symbol]) {
          tokenSummary[symbol] = {
            sentAmount: 0,
            receivedAmount: 0,
            fiatValueReceived: 0,
            fiatValueSent: 0,
          };
        }
        if (t.amount < 0) {
          tokenSummary[symbol].sentAmount += t.amount;
        }
        if (t.amount > 0) {
          tokenSummary[symbol].receivedAmount += t.amount;
        }
      });
    });
  return Object.entries(tokenSummary)
    .map(([symbol, value]) => ({ symbol, ...value }))
    .sort((a, b) => (a.symbol > b.symbol ? 1 : -1));
});

const columns = computed(() => [
  {
    name: 'symbol',
    label: 'Token',
    align: 'left',
    field: (row: SummaryItem) => row.symbol,
    sortable: true,
  },
  {
    name: 'receivedAmount',
    align: 'right',
    label: 'Amount received',
    field: (row: SummaryItem) => formatCryptoAmount(row.receivedAmount ?? 0),
    sortable: true,
  },
  {
    name: 'sentAmount',
    align: 'right',
    label: 'Amount sent',
    field: (row: SummaryItem) =>
      formatCryptoAmount(Math.abs(row.sentAmount ?? 0)),
    sortable: true,
  }
]);
</script>
