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
import { computed, onMounted, onUnmounted, ref, Ref } from 'vue';
import { GChart } from 'vue-google-charts';
import { formatDate } from '../../../../shared-module/util/date-utils';
import { useTaxableEventStore } from '../../../store/taxable-events.store';
import { Rewards } from '../../../../shared-module/model/rewards';
import { Subscription } from 'rxjs';

const rewardsStore = useTaxableEventStore();
const loading = ref(true);

const props = defineProps({
  currency: Boolean,
  chartType: String,
});

const rewards: Ref<Rewards | undefined> = ref(undefined);

let subscription: Subscription;

onMounted(() => {
  subscription = rewardsStore.stakingRewards$.subscribe((r) => {
    rewards.value = r;
  });
});

const hasData = computed(() => {
  return (rewards.value?.values || []).length !== 0;
});

onUnmounted(() => {
  if (subscription) {
    subscription.unsubscribe();
  }
});

function onChartReady() {
  loading.value = false;
}

const rewardDataTable = computed(() => {
  if (!rewards.value || rewards.value.values.length === 0) return [];

  const header = [['date', 'Amount']];
  const sortedValues = (rewards.value.values || []).sort((a, b) =>
    a.isoDate! < b.isoDate! ? -1 : 1
  );
  const minDay = sortedValues[0].isoDate!;
  const maxDay = sortedValues[sortedValues.length - 1].isoDate!;
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
  } while (isoDate < maxDay);
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
