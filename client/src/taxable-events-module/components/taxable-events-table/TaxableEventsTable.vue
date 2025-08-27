<template>
  <div class="q-pa-md">
    <q-table
      :rows="rows"
      :columns="columns"
      row-key="id"
      no-data-label="No taxable events found"
      :pagination="initialPagination"
      selection="multiple"
      v-model:selected="store.excludedEntries"
    >
      <template v-slot:header-selection="scope">
        Excluded <q-toggle v-model="scope.selected" />
      </template>

      <template v-slot:body-selection="scope">
        <q-toggle v-model="scope.selected" />
      </template>

      <template v-slot:top>
        <q-btn color="primary" class="q-mr-sm" data-testid="pdfExport"
          >Export Pdf
        </q-btn>
        <q-btn color="primary" class="q-mr-sm" data-testid="csvExport"
          >Export CSV
        </q-btn>
        <q-btn color="primary" class="q-mr-sm" data-testid="koinlyExport"
          >Koinly Export
        </q-btn>
      </template>

      <template v-slot:body-cell-extrinsic-index="props">
        <q-td :props="props">
          <a
            v-if="props.row.extrinsic_index"
            :href="getSubScanTxLink(props.row.extrinsic_index)"
            target="_blank"
            >{{ props.row.extrinsic_index }}</a
          >
        </q-td>
      </template>

      <template v-slot:body-cell-label="props">
        <q-td :props="props">
          <div>
            {{ props.row.label }}
          </div>
          <div v-if="props.row.isTransferToSelf">(Transfer to self)</div>
        </q-td>
      </template>

      <template v-slot:body-cell-tokens-sent="props">
        <q-td :props="props">
          <div v-for="(item, idx) in props.row.tokensSent" v-bind:key="idx">
            {{ item }}
          </div>
        </q-td>
      </template>

      <template v-slot:body-cell-fiat-sent="props">
        <q-td :props="props">
          <div v-for="(item, idx) in props.row.fiatSent" v-bind:key="idx">
            {{ item }}
          </div>
        </q-td>
      </template>

      <template v-slot:body-cell-tokens-received="props">
        <q-td :props="props">
          <div v-for="(item, idx) in props.row.tokensReceived" v-bind:key="idx">
            {{ item }}
          </div>
        </q-td>
      </template>

      <template v-slot:body-cell-fiat-received="props">
        <q-td :props="props">
          <div v-for="(item, idx) in props.row.fiatReceived" v-bind:key="idx">
            {{ item }}
          </div>
        </q-td>
      </template>

      <template v-slot:body-cell-addresses="props">
        <q-td :props="props">
          <div v-for="(item, idx) in props.row.addresses" v-bind:key="idx">
            <a :href="getSubscanAddressLink(item)" target="_blank"
              >{{ item.substring(0, 5) }}...</a
            >
          </div>
        </q-td>
      </template>
    </q-table>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { TaxData } from '../../../shared-module/model/tax-data';
import { TaxableEvent } from '../../../shared-module/model/taxable-event';
import {
  formatCryptoAmount,
  formatCurrency,
} from '../../../shared-module/util/number-formatters';
import { useSharedStore } from '../../../shared-module/store/shared.store';

const store = useTaxableEventStore();
const taxData: Ref<TaxData | undefined> = ref(undefined);
const tokenFilter: Ref<{ name: string; value: boolean }[]> = ref([]);

const userWallets: Ref<string[]> = ref([]);

const taxDataSubscription = store.visibleTaxData$.subscribe(async (data) => {
  taxData.value = data;
});

const walletSubscription = useSharedStore().walletsAddresses$.subscribe(
  async (wallets) => {
    userWallets.value = wallets;
  }
);

const tokenFilterSubscription = store.visibleTokens$.subscribe(async (data) => {
  tokenFilter.value = data;
});

onUnmounted(() => {
  taxDataSubscription.unsubscribe();
  tokenFilterSubscription.unsubscribe();
  walletSubscription.unsubscribe();
});

function isVisible(token: string) {
  return tokenFilter.value.find((t) => t.name === token)?.value;
}

const columns = computed(() => [
  {
    name: 'isoDate',
    required: true,
    label: 'Date',
    align: 'left',
    field: (row: TaxableEvent) => row.isoDate,
    sortable: true,
  },
  {
    name: 'taxCategory',
    align: 'right',
    label: 'Tax Category',
    field: 'taxCategory',
    sortable: true,
  },
  {
    name: 'label',
    align: 'right',
    label: 'Type',
    sortable: true,
  },
  {
    name: 'extrinsic-index',
    align: 'right',
    label: 'Transaction Extrinsic Idx',
    field: 'extrinsic_index',
    sortable: true,
  },
  {
    name: 'tokens-sent',
    align: 'right',
    label: 'Sent tokens',
    sortable: false,
  },
  {
    name: 'fiat-sent',
    align: 'right',
    label: 'Fiat value sent',
    field: 'fiatSent',
    sortable: false,
  },
  {
    name: 'tokens-received',
    align: 'right',
    label: 'Received tokens',
    sortable: false,
  },
  {
    name: 'fiat-received',
    align: 'right',
    label: 'Fiat value received',
    field: 'fiatReceived',
    sortable: false,
  },
  {
    name: 'addresses',
    align: 'right',
    label: 'From/to',
    sortable: false,
  },
  {
    name: 'notes',
    align: 'right',
    label: 'Notes',
    field: 'callModuleDescription',
    sortable: true,
  },
]);

const rows = computed(() => {
  const flattened: any[] = [];
  taxData.value?.values.forEach((data: TaxableEvent) => {
    flattened.push({
      block: data.block,
      timestamp: data.timestamp,
      isoDate: data.isoDate,
      hash: data.hash,
      tokensSent: data.transfers
        .filter((t) => t.amount < 0 && isVisible(t.symbol))
        .map((t) => `${formatCryptoAmount(-t.amount)} ${t.symbol}`),
      tokensReceived: data.transfers
        .filter((t) => t.amount > 0 && isVisible(t.symbol))
        .map((t) => `${formatCryptoAmount(t.amount)} ${t.symbol}`),
      label: data.label,
      callModuleDescription: [
        data.callModule ?? '',
        data.callModuleFunction ?? '',
      ]
        .filter((t) => !!t)
        .join('-'),
      extrinsic_index: data.extrinsic_index,
      addresses: data.transfers
        .map((t) => [t.from, t.to])
        .flat()
        .filter((a) => !!a),
      fiatSent: data.transfers
        .filter((t) => t.amount < 0 && isVisible(t.symbol))
        .map((t) =>
          t.fiatValue
            ? formatCurrency(
                Math.abs(t.fiatValue),
                taxData.value?.currency || '-'
              )
            : '-'
        ),
      fiatReceived: data.transfers
        .filter((t) => t.amount > 0 && isVisible(t.symbol))
        .map((t) =>
          t.fiatValue
            ? formatCurrency(
                Math.abs(t.fiatValue),
                taxData.value?.currency || '-'
              )
            : '-'
        ),
      id: data.id,
      taxCategory: 'Income',
      isTransferToSelf: isTransferToSelf(data),
    });
  });
  return flattened;
});

const isTransferToSelf = (data: TaxableEvent) => {
  return data.transfers.every(
    (t) =>
      t.from &&
      t.to &&
      userWallets.value.includes(t.from) &&
      userWallets.value.includes(t.to)
  );
};

const initialPagination = ref({
  sortBy: 'timestamp',
  descending: true,
  page: 1,
  rowsPerPage: 20,
});

function getSubScanTxLink(extrinsic_index: string) {
  if (!extrinsic_index || !taxData.value) {
    return undefined;
  }
  return `https://${taxData.value.chain}.subscan.io/extrinsic/${extrinsic_index}`;
}

function getSubscanAddressLink(address: string) {
  if (!address || !taxData.value) {
    return undefined;
  }
  return `https://${taxData.value.chain}.subscan.io/account/${address}`;
}
</script>
