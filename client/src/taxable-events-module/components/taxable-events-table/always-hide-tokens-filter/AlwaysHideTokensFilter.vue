<template>
  <q-btn-dropdown color="primary" label="Always hide tokens">
    <div v-for="token in hiddenTokens" v-bind:key="token.name">
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
import { onBeforeUnmount, ref, Ref } from 'vue';
import { useTaxableEventStore } from '../../../store/taxable-events.store';

const store = useTaxableEventStore();

const hiddenTokens: Ref<{ name: string; value: boolean }[]> = ref([]);

const subscription = store.hiddenTokens$.subscribe((t) => {
  hiddenTokens.value = [...t];
});

onBeforeUnmount(() => {
  subscription.unsubscribe();
});

function clearAll() {
  store.clearHiddenTokens();
}

function onCheckBoxClicked(token: string) {
  store.toggleHiddenToken(token);
}
</script>
