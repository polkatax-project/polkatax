<template>
  <div>
    <div class="q-ma-sm text-center">
      <div class="text-bold">{{ chainName }}</div>
      <div>Wallet: {{ route.params.wallet }}</div>
      <div>
        Time frame:
        <q-btn
          @click="
            () => {
              showDateRangeModal = !showDateRangeModal;
            }
          "
          >{{ dateRange?.from }} - {{ dateRange?.to }}</q-btn
        >
      </div>
    </div>
    <q-tabs
      v-model="tab"
      active-color="primary"
      indicator-color="primary"
      class="bg-grey-1"
    >
      <q-tab name="events" icon="receipt_long" label="All Taxable Events">
      </q-tab>
      <q-tab
        name="rewards"
        icon="currency_bitcoin"
        label="Staking Rewards"
      ></q-tab>
      <q-tab
        name="portfolio"
        icon="work"
        label="Portfolio"
        :disable="!taxData?.portfolioSupported"
      >
        <q-tooltip
          v-if="!taxData?.portfolioSupported"
          anchor="top middle"
          self="bottom middle"
          >Portfolio view is not supported for this chain.</q-tooltip
        >
      </q-tab>
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="events" class="bg-grey-1">
        <TaxableEventsTable />
        <AssetMovementSummaryTable />
      </q-tab-panel>

      <q-tab-panel name="rewards" class="bg-grey-1">
        <StakingRewards />
      </q-tab-panel>

      <q-tab-panel name="portfolio" class="bg-grey-1">
        <PortfolioTable />
      </q-tab-panel>
    </q-tab-panels>
  </div>
  <q-dialog
    :model-value="showDateRangeModal"
    @update:model-value="
      () => {
        showDateRangeModal = false;
      }
    "
  >
    <q-card style="width: 50%; max-width: 400px">
      <q-card-section>
        <div class="text-h6">Time frame</div>
      </q-card-section>

      <q-card-section>
        <DateRangePicker
          @update:model-value="onUpdateDateRange"
          :maxDate="maxDate"
          :dateRange="dateRange"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script setup lang="ts">
import TaxableEventsTable from './taxable-events-table/TaxableEventsTable.vue';
import { useRoute } from 'vue-router';
import { useTaxableEventStore } from '../store/taxable-events.store';
import { computed, onBeforeMount, onMounted, Ref, ref } from 'vue';
import StakingRewards from './staking-rewards/StakingRewards.vue';
import AssetMovementSummaryTable from './asset-movement-summary-table/AssetMovementSummaryTable.vue';
import PortfolioTable from './portfolio-table/PortfolioTable.vue';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { SubstrateChain } from '../../shared-module/model/substrate-chain';
import { TaxData } from '../../shared-module/model/tax-data';
import { Subscription } from 'rxjs';
import DateRangePicker from '../../shared-module/components/date-range-picker/DateRangePicker.vue';

const tab = ref('events');

const store = useTaxableEventStore();
const route = useRoute();
const chains: Ref<SubstrateChain[]> = ref([]);
const taxData: Ref<TaxData | undefined> = ref(undefined);
const dateRange: Ref<{ from: string; to: string } | undefined> = ref(undefined);

const sharedStore = useSharedStore();
let subscanChainsSubscription: Subscription;
let taxDataSubscription: Subscription;
let dateRangeSubscription: Subscription;

const showDateRangeModal = ref(false);

function onUpdateDateRange(newRange: { from: string; to: string }) {
  showDateRangeModal.value = false;
  store.setDateRange(newRange);
}

onMounted(() => {
  store.setCurrency(route.params.currency as string);
  store.setBlockchain(route.params.blockchain as string);
  store.setWallet(route.params.wallet as string);
  store.resetFilters();

  subscanChainsSubscription = sharedStore.subscanChains$.subscribe((data) => {
    chains.value = data.chains;
  });

  taxDataSubscription = store.visibleTaxData$.subscribe((data) => {
    taxData.value = data;
  });

  dateRangeSubscription = store.dateRange$.subscribe((data) => {
    dateRange.value = data;
  });
});

const chainName = computed(() => {
  return (
    chains.value.find((c) => c.domain === (route.params.blockchain as string))
      ?.label ?? '-'
  );
});

onBeforeMount(() => {
  subscanChainsSubscription?.unsubscribe();
  taxDataSubscription?.unsubscribe();
  dateRangeSubscription?.unsubscribe();
});

const maxDate = computed(() => {
  return taxData.value?.toDate;
});
</script>
