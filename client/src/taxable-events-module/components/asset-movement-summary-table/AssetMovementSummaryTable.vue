<template>
  <div class="q-pa-md">
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
  formatCurrency,
} from '../../../shared-module/util/number-formatters';
import { isTokenVisible } from '../../helper/is-token-visible';

const store = useTaxableEventStore();
const taxData: Ref<TaxData | undefined> = ref(undefined);
const visibleTokens: Ref<{ name: string; value: boolean }[]> = ref([]);

const taxDataSubscription = store.visibleTaxData$.subscribe(async (data) => {
  taxData.value = data;
});

const visibleTokensSubscription = store.visibleTokens$.subscribe((data) => {
  visibleTokens.value = data;
});

onUnmounted(() => {
  taxDataSubscription.unsubscribe();
  visibleTokensSubscription.unsubscribe();
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
  taxData.value?.values.forEach((v) => {
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
        tokenSummary[symbol].fiatValueSent += t.fiatValue ?? NaN;
      }
      if (t.amount > 0) {
        tokenSummary[symbol].receivedAmount += t.amount;
        tokenSummary[symbol].fiatValueReceived += t.fiatValue ?? NaN;
      }
    });
  });
  return Object.entries(tokenSummary)
    .map(([symbol, value]) => ({ symbol, ...value }))
    .filter((t) => isTokenVisible(visibleTokens.value, t.symbol));
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
    name: 'fiatValueReceived',
    align: 'right',
    label: 'Value received',
    field: (row: SummaryItem) =>
      formatCurrency(
        Math.abs(row.fiatValueReceived),
        taxData.value?.currency || '-'
      ),
    sortable: true,
  },
  {
    name: 'sentAmount',
    align: 'right',
    label: 'Amount sent',
    field: (row: SummaryItem) =>
      formatCryptoAmount(Math.abs(row.sentAmount ?? 0)),
    sortable: true,
  },
  {
    name: 'fiatValueSent',
    align: 'right',
    label: 'Value sent',
    field: (row: SummaryItem) =>
      formatCurrency(
        Math.abs(row.fiatValueSent),
        taxData.value?.currency || '-'
      ),
    sortable: true,
  },
]);
</script>
