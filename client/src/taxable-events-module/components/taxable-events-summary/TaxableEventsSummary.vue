<template>
  <div class="text-h5 text-center">Taxable events</div>
  <table class="q-my-lg q-mx-auto">
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
          {{ taxData?.chain }}
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
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, Ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { TaxData } from '../../../shared-module/model/tax-data';

const store = useTaxableEventStore();
const taxData: Ref<TaxData | undefined> = ref(undefined);

const taxDataSubscription = store.visibleTaxData$.subscribe(async (data) => {
  taxData.value = data;
});

onBeforeUnmount(() => {
  taxDataSubscription.unsubscribe();
});
</script>
