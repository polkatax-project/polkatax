<template>
  <div class="q-pa-md content q-mx-auto">
    <div style="max-width: 600px; margin: 0 auto; text-align: left">
      <strong>Balance Differences</strong>
      <p>
        This table compares actual token balance changes with those calculated
        from transactions. Unexplained differences mostly occur because:
      </p>
      <ul>
        <li>Some cross-chain (XCM) transfers may not be fully recognized.</li>
        <li>Some events not not processed.</li>
        <li>Transaction fees are not yet included.</li>
      </ul>
    </div>

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
import { computed, onUnmounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { TaxData } from '../../../shared-module/model/tax-data';
import { formatCryptoAmount } from '../../../shared-module/util/number-formatters';
import { Deviation } from '../../../shared-module/model/deviation';

const store = useTaxableEventStore();
const taxData: Ref<TaxData | undefined> = ref(undefined);

const taxDataSubscription = store.taxData$.subscribe(async (data) => {
  taxData.value = data;
  taxData.value.deviations.sort((a, b) => (a.symbol > b.symbol ? 1 : -1));
});

onUnmounted(() => {
  taxDataSubscription.unsubscribe();
});

const columns = computed(() => [
  {
    name: 'warn',
    label: '',
    align: 'left',
    field: (row: Deviation) => (row.absoluteDeviationTooLarge ? '⚠️' : ''),
    sortable: true,
  },
  {
    name: 'symbol',
    label: 'Token',
    align: 'left',
    field: (row: Deviation) => row.symbol,
    sortable: true,
  },
  {
    name: 'balanceBefore',
    align: 'right',
    label: `Balance on ${taxData.value?.fromDate}`,
    field: (row: Deviation) => formatCryptoAmount(row.balanceBefore ?? 0),
    sortable: true,
  },
  {
    name: 'balanceAfter',
    align: 'right',
    label: `Balance on ${taxData.value?.toDate}`,
    field: (row: Deviation) => formatCryptoAmount(row.balanceAfter ?? 0),
    sortable: true,
  },
  {
    name: 'balance-change',
    align: 'right',
    label: 'Balance change',
    field: (row: Deviation) => formatCryptoAmount(row.diff),
    sortable: false,
  },
  {
    name: 'expected-balance-change',
    align: 'right',
    label: 'Expected balance change',
    field: (row: Deviation) => formatCryptoAmount(row.expectedDiff),
    sortable: false,
  },
  {
    name: 'unexplained-balance-change',
    align: 'right',
    label: 'Unexplained balance change',
    sortable: false,
  },
]);

function getSubScanAssetLink(deviation: Deviation) {
  if (deviation.symbol === deviation.unique_id) {
    return `https://${
      taxData.value!.chain
    }.subscan.io/system_token_detail?unique_id=${deviation.symbol}`;
  }
  return `https://${taxData.value!.chain}.subscan.io/custom_token?unique_id=${
    deviation.unique_id
  }`;
}

const rows = computed(() => {
  return (taxData.value?.deviations ?? []).filter(d => d.deviation > 0 || d.balanceAfter > 0 || d.balanceBefore > 0 || d.numberTx > 0);
});
</script>
