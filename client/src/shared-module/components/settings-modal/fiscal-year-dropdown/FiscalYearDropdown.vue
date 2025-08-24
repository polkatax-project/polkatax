<template>
  <div>
    <q-btn-dropdown style="background-color: #dc5cf6">
      <template v-slot:label>
        <div :style="{ opacity: selectedFiscalYear ? 1 : 0 }">
          {{ selectedFiscalYear }}
        </div>
      </template>
      <q-list>
        <q-item
          clickable
          v-close-popup
          @click="onNewValueSelected(fiscalYear.name)"
          v-for="fiscalYear of fiscalYears"
          v-bind:key="fiscalYear.name"
        >
          <q-item-section>
            <q-item-label>
              {{ fiscalYear.name }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, Ref, ref } from 'vue';
import { useSharedStore } from '../../../store/shared.store';
import { FiscalYear } from '../../../model/fiscal-year';

const fiscalYears: Ref<{ name: FiscalYear }[]> = ref([
  { name: 'Jan 1 - Dec 31' },
  { name: 'Apr 1 - Mar 31' },
  { name: 'Jul 1 - Jun 30' },
  { name: 'Oct 1 - Sep 30' },
  { name: 'Mar 1 - Feb 28/29' },
]);

const selectedFiscalYear: Ref<string | undefined> = ref(undefined);
const store = useSharedStore();
const subscription = store.fiscalYear$.subscribe((c) => {
  selectedFiscalYear.value = fiscalYears.value.find(
    (temp) => temp.name === c
  )?.name;
});

onBeforeUnmount(() => {
  subscription.unsubscribe();
});

function onNewValueSelected(value: FiscalYear) {
  selectedFiscalYear.value = value;
  store.selectFiscalYear(value);
}
</script>
