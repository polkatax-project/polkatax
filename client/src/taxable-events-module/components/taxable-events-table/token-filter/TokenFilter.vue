<template>
  <q-btn-dropdown label="Only show transfers with...">
    <div v-for="token in tokenFilter" v-bind:key="token.name">
      <q-checkbox
        :model-value="token.value"
        @update:model-value="onCheckBoxClicked(token.name)"
        :label="token.name.toUpperCase()"
      />
    </div>
    <q-separator></q-separator>
    <q-btn class="q-ma-sm" @click="clearAll">Clear all</q-btn>
  </q-btn-dropdown>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, Ref } from 'vue';
import { useTaxableEventStore } from '../../../store/taxable-events.store';
import { Subscription } from 'rxjs';

const store = useTaxableEventStore();

const tokenFilter: Ref<{ name: string; value: boolean }[]> = ref([]);

let subscription: Subscription;

onMounted(() => {
  subscription = store.tokenFilter$.subscribe((t) => {
    tokenFilter.value = [...t];
  });
});

onBeforeUnmount(() => {
  subscription.unsubscribe();
});

function clearAll() {
  store.clearTokenFilter();
}

function onCheckBoxClicked(token: string) {
  store.toggleTokenFilter(token);
}
</script>
