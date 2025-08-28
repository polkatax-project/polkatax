<template>
  <div>
    <q-tabs v-model="tab" active-color="primary" indicator-color="primary">
      <q-tab name="events" icon="receipt_long" label="All Taxable Events">
      </q-tab>
      <q-tab
        name="rewards"
        icon="currency_bitcoin"
        label="Staking Rewards"
      ></q-tab>
      <q-tab name="issues" icon="error_outline" label="Issues"> </q-tab>
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="events">
        <div class="content q-mx-auto">
          <TaxableEventsSummary />
          <EventTypeFilter />
          <TokenFilter />
        </div>
        <TaxableEventsTable />
        <AssetMovementSummaryTable />
      </q-tab-panel>

      <q-tab-panel name="rewards">
        <StakingRewards />
      </q-tab-panel>

      <q-tab-panel name="issues">
        <DeviationsTable />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>
<script setup lang="ts">
import DeviationsTable from './deviations-table/DeviationsTable.vue';
import TaxableEventsTable from './taxable-events-table/TaxableEventsTable.vue';
import TokenFilter from './token-filter/TokenFilter.vue';
import EventTypeFilter from './event-type-filter/EventTypeFilter.vue';
import { useRoute } from 'vue-router';
import { useTaxableEventStore } from '../store/taxable-events.store';
import TaxableEventsSummary from './taxable-events-summary/TaxableEventsSummary.vue';
import { ref } from 'vue';
import StakingRewards from './staking-rewards/StakingRewards.vue';
import AssetMovementSummaryTable from './asset-movement-summary-table/AssetMovementSummaryTable.vue';

const tab = ref('events');

const store = useTaxableEventStore();
const route = useRoute();

store.setCurrency(route.params.currency as string);
store.setBlockchain(route.params.blockchain as string);
store.setWallet(route.params.wallet as string);
store.resetFilters();
</script>
