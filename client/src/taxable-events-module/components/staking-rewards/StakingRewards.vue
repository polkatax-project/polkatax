<template>
  <q-page class="q-px-sm q-mx-auto content">
    <div class="text-center q-my-xl">
      <reward-summary />
    </div>
    <div
      class="justify-around items-center column"
      v-if="data && Object.keys(data.dailyValues).length > 20"
    >
      <rewards-chart :currency="false" chartType="ColumnChart" />
    </div>
    <div class="q-my-md" v-if="data">
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
import { onUnmounted, Ref, ref } from 'vue';
import { useTaxableEventStore } from '../../store/taxable-events.store';
import { Rewards } from '../../../shared-module/model/rewards';

const rewardsStore = useTaxableEventStore();

const data: Ref<Rewards | undefined> = ref(undefined);

const rewardsSubscription = rewardsStore.stakingRewards$.subscribe(
  async (rewards) => {
    data.value = rewards;
  }
);

onUnmounted(() => {
  rewardsSubscription.unsubscribe();
});
</script>
