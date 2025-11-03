<template>
  <div class="q-pa-md content q-mx-auto">
    <q-table
      :rows="rows"
      :columns="columns"
      row-key="id"
      :pagination="{ rowsPerPage: 20 }"
      no-data-label="No balances found"
    >
      <template v-slot:body-cell-symbol="props">
        <q-td :props="props">
          <a
            v-if="props.row.unique_id"
            :href="getSubScanAssetLink(props.row)"
            target="_blank"
            >{{ props.row.symbol }}</a
          >
          <span v-if="!props.row.unique_id">
            {{ props.row.symbol }}
          </span>
        </q-td>
      </template>
      <template v-slot:body-cell-unexplained-balance-change="props">
        <q-td :props="props">
          <span
            :style="{
              'background-color': props.row.absoluteDeviationTooLarge
                ? 'yellow'
                : '',
            }"
            >{{ formatCryptoAmount(props.row.deviation) }}</span
          >
        </q-td>
      </template>
    </q-table>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import {
  formatCryptoAmount,
  formatCurrency,
} from '../../../shared-module/util/number-formatters';
import { Subscription } from 'rxjs';
import { Portfolio, PortfolioEntry } from '../../service/portfolio.service';

const store = useTaxableEventStore();
const portfolio: Ref<Portfolio | undefined> = ref(undefined);
let portfolioSubscription: Subscription;

onMounted(() => {
  portfolioSubscription = store.portfolio$.subscribe(async (data) => {
    portfolio.value = data;
    portfolio.value.balances.sort((a, b) => (a.symbol > b.symbol ? 1 : -1));
  });
});

onUnmounted(() => {
  portfolioSubscription?.unsubscribe();
});

const columns = computed(() => {
  const cols = [
    {
      name: 'warn',
      label: '',
      align: 'left',
      field: (row: PortfolioEntry) =>
        row.absoluteDeviationTooLarge ? '⚠️' : '',
      sortable: true,
    },
    {
      name: 'symbol',
      label: 'Token',
      align: 'left',
      field: (row: PortfolioEntry) => row.symbol,
      sortable: true,
    },
    {
      name: 'balanceBefore',
      align: 'right',
      label: `Balance on ${portfolio.value?.rangeStartDate}`,
      field: (row: PortfolioEntry) => formatCryptoAmount(row.rangeStart ?? 0),
      sortable: true,
    },
    {
      name: 'balanceAfter',
      align: 'right',
      label: `Balance on ${portfolio.value?.rangeEndDate}`,
      field: (row: PortfolioEntry) => formatCryptoAmount(row.rangeEnd ?? 0),
      sortable: true,
    },
    {
      name: 'fees',
      align: 'right',
      label: 'Fees',
      field: (row: PortfolioEntry) =>
        `${formatCryptoAmount(row.fees)}` +
        (row.feesFiat > 0
          ? ` (${formatCurrency(
              row.feesFiat,
              portfolio.value?.currency ?? 'USD'
            )})`
          : ''),
      sortable: false,
    },
    {
      name: 'balance-change',
      align: 'right',
      label: 'Balance change',
      field: (row: PortfolioEntry) =>
        formatCryptoAmount((row.rangeEnd ?? 0) - (row.rangeStart ?? 0)),
      sortable: false,
    },
  ];
  if (!portfolio.value?.customRange) {
    cols.push({
      name: 'expected-balance-change',
      align: 'right',
      label: 'Expected balance change',
      field: (row: PortfolioEntry) => formatCryptoAmount(row.expectedDiff),
      sortable: false,
    });
    cols.push({
      name: 'unexplained-balance-change',
      align: 'right',
      field: (row: PortfolioEntry) =>
        formatCryptoAmount(Math.abs(row.deviation)),
      label: 'Unexplained balance change',
      sortable: false,
    });
  }
  return cols;
});

function getSubScanAssetLink(deviation: PortfolioEntry) {
  if (deviation.symbol === deviation.unique_id) {
    return `https://${
      portfolio.value!.chain
    }.subscan.io/system_token_detail?unique_id=${deviation.symbol}`;
  }
  const idParts = deviation.unique_id.split('/');
  if (idParts?.[0] === 'foreign_assets') {
    return `https://${portfolio.value!.chain}.subscan.io/foreign_assets/${
      idParts[1]
    }`;
  }
  if (idParts?.[0] === 'standard_assets') {
    return `https://${portfolio.value!.chain}.subscan.io/assets/${idParts[1]}`;
  }
  return `https://${portfolio.value!.chain}.subscan.io/custom_token?unique_id=${
    deviation.unique_id
  }`;
}

const rows = computed(() => {
  return (portfolio.value?.balances ?? []).filter(
    (d) =>
      d.deviation > 0 ||
      d.balanceAfter > 0 ||
      d.balanceBefore > 0 ||
      d.numberTx > 0
  );
});
</script>
