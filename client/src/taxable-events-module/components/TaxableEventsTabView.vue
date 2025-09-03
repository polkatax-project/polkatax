<template>
  <div>
    <div class="q-ma-sm text-center">
      <div class="text-bold">{{ chainName }}</div>
      <div>Wallet: {{ taxData?.address }}</div>
      <div>Time frame: {{ taxData?.fromDate }} - {{ taxData?.toDate }}</div>
    </div>
    <q-tabs v-model="tab" active-color="primary" indicator-color="primary">
      <q-tab name="events" icon="receipt_long" label="All Taxable Events">
      </q-tab>
      <q-tab
        name="rewards"
        icon="currency_bitcoin"
        label="Staking Rewards"
      ></q-tab>
      <q-tab name="portfolio" icon="work" label="Portfolio"> </q-tab>
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="events">
        <div class="content q-mx-auto">
          <EventTypeFilter />
          <TokenFilter />
        </div>
        <TaxableEventsTable />
        <AssetMovementSummaryTable />
      </q-tab-panel>

      <q-tab-panel name="rewards">
        <StakingRewards />
      </q-tab-panel>

      <q-tab-panel name="portfolio">
        <PortfolioTable />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>
<script setup lang="ts">
import TaxableEventsTable from './taxable-events-table/TaxableEventsTable.vue';
import TokenFilter from './token-filter/TokenFilter.vue';
import EventTypeFilter from './event-type-filter/EventTypeFilter.vue';
import { useRoute } from 'vue-router';
import { useTaxableEventStore } from '../store/taxable-events.store';
import { computed, onBeforeMount, Ref, ref } from 'vue';
import StakingRewards from './staking-rewards/StakingRewards.vue';
import AssetMovementSummaryTable from './asset-movement-summary-table/AssetMovementSummaryTable.vue';
import PortfolioTable from './portfolio-table/PortfolioTable.vue';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { SubstrateChain } from '../../shared-module/model/substrate-chain';
import { TaxData } from '../../shared-module/model/tax-data';

const tab = ref('events');

const store = useTaxableEventStore();
const route = useRoute();
const chains: Ref<SubstrateChain[]> = ref([]);
const taxData: Ref<TaxData | undefined> = ref(undefined);

const sharedStore = useSharedStore();
const subscanChainsSubscription = sharedStore.subscanChains$.subscribe(
  (data) => {
    chains.value = data.chains;
  }
);

const taxDataSubscription = store.taxData$.subscribe((data) => {
  taxData.value = data;
});

const chainName = computed(() => {
  return (
    chains.value.find((c) => c.domain === (route.params.blockchain as string))
      ?.label ?? '-'
  );
});

onBeforeMount(() => {
  subscanChainsSubscription.unsubscribe();
  taxDataSubscription.unsubscribe();
});

store.setCurrency(route.params.currency as string);
store.setBlockchain(route.params.blockchain as string);
store.setWallet(route.params.wallet as string);
store.resetFilters();
</script>
