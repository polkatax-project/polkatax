<template>
  <q-card class="q-ma-md q-pa-md">
    <div class="text-h6 text-center">Token Filter</div>
    <div class="flex justify-center">
      <q-checkbox
        :model-value="all"
        @update:model-value="toggleAll"
        label="All"
      />
      <div v-for="token in visibleTokens" v-bind:key="token.name">
        <q-checkbox :model-value="token.value" @update:model-value="onCheckBoxClicked(token.name)" :label="token.name.toUpperCase()" />
      </div>
    </div>
  </q-card>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, Ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';

const store = useTaxableEventStore();

const visibleTokens: Ref<{ name: string, value: boolean}[]> = ref([])

const subscription = store.visibleTokens$.subscribe(t => {
  visibleTokens.value = [...t]
})

onBeforeUnmount(() => {
  subscription.unsubscribe()
})

const all = computed(() => {
  return visibleTokens.value.every((t: { value: boolean }) => t.value);
});

function toggleAll() {
  store.toggleAllVisibleTokens()
}

function onCheckBoxClicked(token: string) {
  store.toggleTokenVisibility(token)
}
</script>
