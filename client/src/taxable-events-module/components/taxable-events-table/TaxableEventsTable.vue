<template>
  <div class="q-pa-md">
    <q-table
      :rows="rows"
      :columns="columns"
      row-key="id"
      no-data-label="No taxable events found"
      :pagination="initialPagination"
      selection="multiple"
      :selected="excludedEntries"
      @update:selected="setExcludedEntries"
    >
      <template v-slot:header-selection="scope">
        Excluded <q-toggle v-model="scope.selected" />
      </template>

      <template v-slot:body-selection="scope">
        <q-toggle v-model="scope.selected" />
      </template>

      <template v-slot:top>
        <div class="column full-width">
          <div class="text-h6">Taxable events</div>
          <div class="flex justify-between">
            <q-btn
              color="primary"
              class="q-mr-sm"
              data-testid="csvExport"
              @click="csvExport"
              >Export CSV
            </q-btn>
            <div>
              <EventTypeFilter class="q-mr-sm desktop-only" />
              <TokenFilter class="q-mr-sm desktop-only" />
              <AlwaysHideTokensFilter class="desktop-only" />
            </div>
          </div>
        </div>
      </template>

      <template v-slot:body-cell-extrinsic-index="props">
        <q-td :props="props">
          <a
            v-if="props.row.extrinsic_index"
            :href="getSubScanTxLink(props.row.extrinsic_index)"
            target="_blank"
            >{{ props.row.extrinsic_index }}</a
          >
          <a
            v-if="!props.row.extrinsic_index && props.row.block"
            :href="getSubScanBlockLink(props.row.block)"
            target="_blank"
            >{{ props.row.block }}</a
          >
        </q-td>
      </template>

      <template v-slot:body-cell-label="props">
        <q-td :props="props">
          <div v-if="props.row.label">
            {{ props.row.label
            }}<span
              v-if="
                props.row.isTransferToSelf && props.row.label === 'XCM transfer'
              "
            >
              to self</span
            >
          </div>
          <div v-if="props.row.xcmDescription">
            ({{ props.row.xcmDescription }})
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

      <template v-slot:body-cell-tokens-sent="props">
        <q-td :props="props">
          <div v-for="(item, idx) in props.row.tokensSent" v-bind:key="idx">
            {{ item }}
          </div>
        </q-td>
      </template>

      <template v-slot:body-cell-fees="props">
        <q-td :props="props">
          <div v-for="(item, idx) in props.row.fees" v-bind:key="idx">
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
import TokenFilter from './token-filter/TokenFilter.vue';
import EventTypeFilter from './event-type-filter/EventTypeFilter.vue';
import { computed, onUnmounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { TaxData } from '../../../shared-module/model/tax-data';
import { TaxableEvent } from '../../../shared-module/model/taxable-event';
import {
  formatCryptoAmount,
  formatCurrency,
} from '../../../shared-module/util/number-formatters';
import { useSharedStore } from '../../../shared-module/store/shared.store';
import { exportKoinlyCsv } from '../../../shared-module/service/export-koinly-csv';
import AlwaysHideTokensFilter from './always-hide-tokens-filter/AlwaysHideTokensFilter.vue';

const store = useTaxableEventStore();
const taxData: Ref<TaxData | undefined> = ref(undefined);
const tokenFilter: Ref<{ name: string; value: boolean }[]> = ref([]);
const excludedEntries: Ref<TaxableEvent[]> = ref([]);
const chains: Ref<{ domain: string; label: string }[] | undefined> =
  ref(undefined);

function setExcludedEntries(value: TaxableEvent[]) {
  excludedEntries.value = value;
  store.setExcludedEntries(value);
}

function csvExport() {
  exportKoinlyCsv(taxData.value!);
}

const userWallets: Ref<string[]> = ref([]);

const taxDataSubscription = store.visibleTaxData$.subscribe(async (data) => {
  taxData.value = data;
});

const walletSubscription = useSharedStore().walletsAddresses$.subscribe(
  async (wallets) => {
    userWallets.value = wallets;
  }
);

const tokenFilterSubscription = store.tokenFilter$.subscribe(async (data) => {
  tokenFilter.value = data;
});

const blockchainsSubscription = useSharedStore().subscanChains$.subscribe(
  (subscanChains) => {
    chains.value = subscanChains.chains;
  }
);

onUnmounted(() => {
  taxDataSubscription.unsubscribe();
  tokenFilterSubscription.unsubscribe();
  walletSubscription.unsubscribe();
  blockchainsSubscription.unsubscribe();
});

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
    name: 'label',
    align: 'right',
    label: 'Type',
    sortable: true,
  },
  {
    name: 'extrinsic-index',
    align: 'right',
    label: 'Transaction/Block',
    field: 'extrinsic_index',
    sortable: true,
  },
  {
    name: 'tokens-received',
    align: 'right',
    label: 'Received tokens',
    sortable: false,
  },
  {
    name: 'tokens-sent',
    align: 'right',
    label: 'Sent tokens',
    sortable: false,
  },
  {
    name: 'fees',
    align: 'right',
    label: 'Fees',
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
        .filter((t) => t.amount < 0)
        .map((t) => `${formatCryptoAmount(-t.amount)} ${t.symbol}`),
      tokensReceived: data.transfers
        .filter((t) => t.amount > 0)
        .map((t) => `${formatCryptoAmount(t.amount)} ${t.symbol}`),
      label: data.label,
      xcmDescription: xcmChainDescription(data),
      callModuleDescription: [
        data.callModule ?? '',
        data.callModuleFunction ?? '',
      ]
        .filter((t) => !!t)
        .join('-'),
      extrinsic_index: data.extrinsic_index,
      addresses: [
        ...new Set(
          data.transfers.flatMap((t) => [t.from, t.to]).filter((a) => !!a)
        ),
      ],
      fees: [
        data.feeUsed ?? 0 > 0
          ? `${formatCryptoAmount(data.feeUsed ?? 0)} ${data.feeTokenSymbol}`
          : undefined,
        data.xcmFeeTokenSymbol
          ? `(XCM) ${formatCryptoAmount(data.xcmFee ?? 0)} ${
              data.xcmFeeTokenSymbol
            }`
          : undefined,
      ].filter((value) => !!value),
      /*fiatSent: data.transfers
        .filter((t) => t.amount < 0)
        .map((t) =>
          formatCurrency(
            Math.abs(t.fiatValue ?? NaN),
            taxData.value?.currency || '-'
          )
        ),
      fiatReceived: data.transfers
        .filter((t) => t.amount > 0)
        .map((t) =>
          formatCurrency(
            Math.abs(t.fiatValue ?? NaN),
            taxData.value?.currency || '-'
          )
        ),*/
      id: data.id,
      taxCategory: 'Income',
      isTransferToSelf: isTransferToSelf(data),
    });
  });
  return flattened;
});

const xcmChainDescription = (data: TaxableEvent) => {
  if (data.label !== 'XCM transfer' || data.transfers.length === 0) {
    return undefined;
  }
  if (data.transfers[0].fromChain === taxData.value?.chain) {
    return data.transfers[0].toChain
      ? '↑' + getLabelForBlockchain(data.transfers[0].toChain)
      : undefined;
  } else {
    return data.transfers[0].fromChain
      ? '↓' + getLabelForBlockchain(data.transfers[0].fromChain)
      : undefined;
  }
};

function getLabelForBlockchain(domain?: string) {
  if (!domain) {
    return domain;
  }
  return !chains.value
    ? domain
    : chains.value.find((c) => c.domain === domain)?.label ?? domain;
}

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
  rowsPerPage: 10,
});

function getSubScanTxLink(extrinsic_index: string) {
  if (!extrinsic_index || !taxData.value) {
    return undefined;
  }
  return `https://${taxData.value.chain}.subscan.io/extrinsic/${extrinsic_index}`;
}

function getSubScanBlockLink(block: string) {
  if (!block || !taxData.value) {
    return undefined;
  }
  return `https://${taxData.value.chain}.subscan.io/block/${block}`;
}

function getSubscanAddressLink(address: string) {
  if (!address || !taxData.value) {
    return undefined;
  }
  return `https://${taxData.value.chain}.subscan.io/account/${address}`;
}
</script>
