<template>
  <q-page class="q-px-sm q-mx-auto content">
    <div class="text-center q-pt-md">
      <reward-summary />
    </div>
    <div
      class="justify-around items-center column q-my-md"
      v-if="Object.keys(data?.dailyValues ?? {}).length > 20"
    >
      <rewards-chart :currency="false" chartType="ColumnChart" />
    </div>
    <div v-if="data">
      <staking-rewards-table />
    </div>
    <div v-if="!data" class="q-my-xl">
      <div class="text-h6 text-center">No rewards found</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import RewardsChart from './rewards-chart/RewardsChart.vue';
import StakingRewardsTable from './staking-rewards-table/StakingRewardsTable.vue';
import RewardSummary from './reward-summary/RewardSummary.vue';
import { onMounted, onUnmounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { Rewards } from '../../../shared-module/model/rewards';
import { Subscription } from 'rxjs';

const rewardsStore = useTaxableEventStore();

const data: Ref<Rewards | undefined> = ref(undefined);

let rewardsSubscription: Subscription;

onMounted(() => {
  rewardsSubscription = rewardsStore.stakingRewards$.subscribe(
    async (rewards) => {
      data.value = rewards;
    }
  );
});

onUnmounted(() => {
  if (rewardsSubscription) {
    rewardsSubscription.unsubscribe();
  }
});
</script>
