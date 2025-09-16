<template>
  <div class="text-h6">Summary of Staking Rewards</div>
  <table class="q-my-lg q-mx-auto" v-if="rewards">
    <tbody>
      <tr v-if="rewards?.summary">
        <td class="text-left q-pa-sm">Total rewards:</td>
        <td class="text-right q-pa-sm" data-testid="total-rewards">
          {{
            formatCryptoAmount(rewards.summary!.amount) + ' ' + rewards!.token
          }}
        </td>
      </tr>
      <tr v-if="rewards?.summary">
        <td class="text-left q-pa-sm">Value at payout time:</td>
        <td class="text-right q-pa-sm" data-testid="value-at-payout-time">
          {{
            isNaN(rewards?.summary?.fiatValue || NaN)
              ? '-'
              : formatCurrency(rewards.summary.fiatValue!, rewards.currency)
          }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, Ref } from 'vue';
import {
  formatCurrency,
  formatCryptoAmount,
} from '../../../../shared-module/util/number-formatters';
import { useTaxableEventStore } from '../../../store/taxable-events.store';
import { Rewards } from '../../../../shared-module/model/rewards';
import { Subscription } from 'rxjs';

const store = useTaxableEventStore();
const rewards: Ref<Rewards | undefined> = ref(undefined);

let subscription: Subscription;

onMounted(() => {
  subscription = store.stakingRewards$.subscribe((data) => {
    rewards.value = data;
  });
});

onBeforeUnmount(() => {
  subscription.unsubscribe();
});
</script>
