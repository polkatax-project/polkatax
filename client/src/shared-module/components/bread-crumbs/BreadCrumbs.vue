<template>
  <q-breadcrumbs class="text-lg text-lg" active-color="black">
    <template v-slot:separator>
      <q-icon size="1.5em" name="chevron_right" color="black" />
    </template>
    <q-breadcrumbs-el
      v-for="breadcrumb in breadcrumbs"
      :data-testid="'breadcrumb-' + breadcrumb.label"
      v-bind:key="breadcrumb.label"
      :label="breadcrumb.label"
      class="text-black"
      style="font-size: 1rem"
      :to="breadcrumb.route"
    />
  </q-breadcrumbs>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const breadcrumbs = computed(() => {
  const breadcrumbs: { label: string; route: string }[] | undefined =
    Array.isArray(route.meta.breadcrumbs)
      ? route.meta.breadcrumbs.map((fn) => fn(route))
      : [];
  return breadcrumbs;
});
</script>
