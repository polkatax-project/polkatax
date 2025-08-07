<template>
  <div>
    <div class="content q-mx-auto">
      <EventTypeFilter/>
      <TokenFilter/>
    </div>
    <TaxableEventsTable />
  </div>
</template>
<script setup lang="ts">
import TaxableEventsTable from './taxable-events-table/TaxableEventsTable.vue';
import TokenFilter from './token-filter/TokenFilter.vue';
import EventTypeFilter from './event-type-filter/EventTypeFilter.vue';
import { useRoute } from 'vue-router';
import { useTaxableEventStore } from '../store/taxable-events.store';

const store = useTaxableEventStore();
const route = useRoute();

store.setCurrency(route.params.currency as string);
store.setBlockchain(route.params.blockchain as string);
store.setWallet(route.params.wallet as string);
store.resetFilters();
</script>
