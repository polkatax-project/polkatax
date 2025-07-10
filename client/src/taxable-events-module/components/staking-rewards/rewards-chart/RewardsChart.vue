<template>
  <div style="width: 100%; min-height: 400px">
    <div v-if="loading" class="text-center">
      <q-spinner color="primary" size="3em" />
    </div>
    <GChart
      v-if="hasData"
      :data="rewardDataTable"
      :type="chartType"
      :options="options"
      style="width: 100%; min-height: 400px"
      @ready="onChartReady"
    ></GChart>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, Ref } from 'vue';
import { GChart } from 'vue-google-charts';
import { useStakingRewardsStore } from '../store/staking-rewards.store';
import { formatDate } from '../../../../shared-module/util/date-utils';
import { StakingRewardsPerYear } from '../../../../shared-module/model/rewards';

const rewardsStore = useStakingRewardsStore();
const loading = ref(true);

const props = defineProps({
  currency: Boolean,
  chartType: String,
});

const rewards: Ref<StakingRewardsPerYear | undefined> = ref(undefined);

const subscription = rewardsStore.rewardsPerYear$.subscribe((r) => {
  rewards.value = r;
});

const hasData = computed(() => {
  return (rewards.value?.values || []).length !== 0;
});

onUnmounted(() => {
  subscription.unsubscribe();
});

function onChartReady() {
  loading.value = false;
}

const rewardDataTable = computed(() => {
  if (!rewards.value || rewards.value.values.length === 0) return [];

  const header = [['date', 'Amount']];
  const minDay = rewards.value.values[0].isoDate;
  const maxDay = rewards.value.values[rewards.value.values.length - 1].isoDate;
  const temp = new Date(minDay);
  temp.setHours(0);
  temp.setMilliseconds(0);
  temp.setSeconds(0);
  const data = [];
  let isoDate = formatDate(temp.getTime());
  do {
    isoDate = formatDate(temp.getTime());
    data.push([
      new Date(isoDate + ':00:00:00'),
      rewards.value.dailyValues[isoDate]?.amount || 0,
    ]);
    temp.setDate(temp.getDate() + 1);
  } while (isoDate !== maxDay);
  return [...header, ...data];
});

const options = computed(() => {
  if (!rewards.value) return {};

  return {
    title: `Rewards (${
      props.currency ? rewards.value.currency : rewards.value.token
    })`,
    curveType: rewards.value.values.length > 50 ? 'function' : undefined,
    legend: { position: 'top' },
    hAxis: {
      title: 'Date',
    },
    vAxis: {
      minValue: 0,
    },
    axisTitlesPosition: 'out',
  };
});
</script>
