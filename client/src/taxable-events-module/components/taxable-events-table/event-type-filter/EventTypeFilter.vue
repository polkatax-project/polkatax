<template>
  <q-btn-dropdown color="primary" label="Transaction type">
    <div
      v-for="filter in Object.entries(eventTypeFilter)"
      v-bind:key="filter[0]"
    >
      <q-checkbox
        :model-value="filter[1]"
        @update:model-value="onCheckBoxClicked(filter[0])"
        :label="filter[0]"
      />
    </div>
    <q-separator></q-separator>
    <q-btn class="q-ma-sm" @click="clearAll">Clear all</q-btn>
  </q-btn-dropdown>
</template>
<script setup lang="ts">
import { onBeforeUnmount, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../../store/taxable-events.store';

const store = useTaxableEventStore();

const eventTypeFilter: Ref<Record<string, boolean>> = ref({});

const subscription = store.eventTypeFilter$.subscribe((f) => {
  eventTypeFilter.value = { ...f };
});

onBeforeUnmount(() => {
  subscription.unsubscribe();
});

function clearAll() {
  store.removeAllEventTypeFilters();
}

function onCheckBoxClicked(filterName: string) {
  store.toggleEventFilter(filterName);
}
</script>
