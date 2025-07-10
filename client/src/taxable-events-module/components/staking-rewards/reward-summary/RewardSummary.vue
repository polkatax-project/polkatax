<template>
  <div class="text-h6">Summary of Staking Rewards</div>
  <table class="q-my-lg q-mx-auto" v-if="rewards">
    <tbody>
      <tr>
        <td class="text-left q-pa-sm">Year:</td>
        <td class="text-right q-pa-sm">{{ new Date().getFullYear() - 1 }}</td>
      </tr>
      <tr>
        <td class="text-left q-pa-sm">Blockchain:</td>
        <td class="text-right q-pa-sm" data-testid="summary-blockchain">
          {{ blockchainLabel ?? rewards.chain }}
        </td>
      </tr>
      <tr>
        <td class="text-left q-pa-sm">Wallet:</td>
        <td class="text-right q-pa-sm" style="overflow-wrap: anywhere">
          {{ rewards.address }}
        </td>
      </tr>
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
import { onBeforeUnmount, ref, Ref } from 'vue';
import { useStakingRewardsStore } from '../store/staking-rewards.store';
import { useSharedStore } from '../../../../shared-module/store/shared.store';
import { combineLatest } from 'rxjs';
import { StakingRewardsPerYear } from '../../../../shared-module/model/rewards';
import {
  formatCurrency,
  formatCryptoAmount,
} from '../../../../shared-module/util/number-formatters';

const rewardsStore = useStakingRewardsStore();
const year: Ref<number | undefined> = ref(undefined);
const rewards: Ref<StakingRewardsPerYear | undefined> = ref(undefined);
const blockchainLabel: Ref<string> = ref('');

const yearSubscription = rewardsStore.year$.subscribe((y) => (year.value = y));

const subscription = combineLatest([
  useSharedStore().subscanChains$,
  rewardsStore.rewardsPerYear$,
]).subscribe(async ([chains, _rewards]) => {
  rewards.value = _rewards;
  blockchainLabel.value =
    chains.chains.find((c) => c.domain === _rewards?.chain)?.label ?? '';
});

onBeforeUnmount(() => {
  subscription.unsubscribe();
  yearSubscription.unsubscribe();
});
</script>
