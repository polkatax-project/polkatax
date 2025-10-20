<template>
  <q-btn-dropdown label="Transaction type">
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
import { onBeforeUnmount, onMounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../../store/taxable-events.store';
import { Subscription } from 'rxjs';

const store = useTaxableEventStore();

const eventTypeFilter: Ref<Record<string, boolean>> = ref({});

let subscription: Subscription;

onMounted(() => {
  subscription = store.eventTypeFilter$.subscribe((f) => {
    eventTypeFilter.value = { ...f };
  });
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
