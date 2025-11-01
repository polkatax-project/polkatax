<template>
  <div>
    <div class="column items-center" style="position: relative">
      <q-date v-model="tempRange" range :options="optionsFn" />
      <div class="row q-gutter-xs" style="position: absolute; bottom: 5px">
        <q-btn @click="setLastYear()" color="primary">Last year</q-btn>
        <q-btn @click="setThisYear()" color="primary">This year</q-btn>
        <q-btn @click="setAll()" color="primary">Max</q-btn>
      </div>
    </div>
    <q-btn class="q-mt-xs" @click="update">Apply</q-btn>
  </div>
</template>
<script setup lang="ts">
import 'vue';
import { computed, ref } from 'vue';

const currentYear = new Date().getFullYear();

const emits = defineEmits(['update:modelValue', 'enter-pressed']);

const props = defineProps<{
  dateRange?: { from: string; to: string };
  maxDate?: string;
}>();

const maximalDate = computed(() => {
  return props.maxDate
    ? props.maxDate.replaceAll('-', '/')
    : `${currentYear}/12/31`;
});

const tempRange = ref(
  props.dateRange
    ? {
        from: props.dateRange.from.replaceAll('-', '/'),
        to: props.dateRange.to.replaceAll('-', '/'),
      }
    : { from: `${currentYear - 1}/01/01`, to: `${currentYear}/12/31` }
);

function optionsFn(date: string) {
  return date >= `${currentYear - 1}/01/01` && date <= maximalDate.value;
}

function setLastYear() {
  tempRange.value = {
    from: `${currentYear - 1}/01/01`,
    to: `${currentYear - 1}/12/31`,
  };
}

function setThisYear() {
  tempRange.value = {
    from: `${currentYear}/01/01`,
    to: `${currentYear}/12/31`,
  };
}

function setAll() {
  tempRange.value = { from: `${currentYear - 1}/01/01`, to: maximalDate.value };
}

function update() {
  emits('update:modelValue', {
    from: tempRange.value.from.replaceAll('/', '-'),
    to: tempRange.value.to.replaceAll('/', '-'),
  });
}
</script>
<style></style>
