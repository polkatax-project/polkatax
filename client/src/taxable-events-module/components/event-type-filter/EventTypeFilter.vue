<template>
  <q-card class="q-ma-md q-pa-md">
    <div class="text-h6 text-center">Transfer Type Filter</div>
    <div class="flex justify-center">
      <q-checkbox
        :model-value="all"
        @update:model-value="toggleAll"
        label="All"
      />
      <div v-for="filter in Object.entries(eventTypeFilter)" v-bind:key="filter[0]">
        <q-checkbox :model-value="filter[1]" @update:model-value="onCheckBoxClicked(filter[0])" :label="filter[0]" />
      </div>
    </div>
  </q-card>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';

const store = useTaxableEventStore();

const eventTypeFilter: Ref<Record<string, boolean>> = ref({})

const subscription = store.eventTypeFilter$.subscribe(f => {
  //Object.assign(eventTypeFilter.value, f)
  eventTypeFilter.value = { ...f }
})

const all = computed(() => {
  return Object.keys(eventTypeFilter.value).every(t => eventTypeFilter.value[t]);
});

onBeforeUnmount(() => {
  subscription.unsubscribe()
})

function toggleAll() {
  store.toggleAllEventTypeFilters()
}

function onCheckBoxClicked(filterName: string) {
  store.toggleEventFilter(filterName)
}
</script>
