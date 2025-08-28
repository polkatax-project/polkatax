<template>
  <q-card class="q-ma-md q-pa-md">
    <table class="q-mx-auto">
      <tbody>
        <tr>
          <td class="text-left q-pa-sm">Time frame:</td>
          <td class="text-right q-pa-sm">
            {{ taxData?.fromDate }} - {{ taxData?.toDate }}
          </td>
        </tr>
        <tr>
          <td class="text-left q-pa-sm">Blockchain:</td>
          <td class="text-right q-pa-sm" data-testid="summary-blockchain">
            {{ chainLabel }}
          </td>
        </tr>
        <tr>
          <td class="text-left q-pa-sm">Wallet:</td>
          <td class="text-right q-pa-sm" style="overflow-wrap: anywhere">
            {{ taxData?.address }}
          </td>
        </tr>
      </tbody>
    </table>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, Ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { TaxData } from '../../../shared-module/model/tax-data';
import { useSharedStore } from '../../../shared-module/store/shared.store';

const store = useTaxableEventStore();
const taxData: Ref<TaxData | undefined> = ref(undefined);
const chains: Ref<{ domain: string; label: string }[]> = ref([]);

const taxDataSubscription = store.visibleTaxData$.subscribe(async (data) => {
  taxData.value = data;
});

const chainsSubscription = useSharedStore().subscanChains$.subscribe(
  (subscanChains) => {
    chains.value = subscanChains.chains;
  }
);

const chainLabel = computed(() => {
  return (
    chains.value.find((c) => c.domain === (taxData.value?.chain ?? 'unknwon'))
      ?.label ?? taxData.value?.chain
  );
});

onBeforeUnmount(() => {
  taxDataSubscription.unsubscribe();
  chainsSubscription.unsubscribe();
});
</script>
