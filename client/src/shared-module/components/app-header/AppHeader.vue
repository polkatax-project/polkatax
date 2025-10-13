<template>
  <q-header height-hint="98" class="bg-grey-1">
    <q-toolbar class="flex justify-between">
      <!-- Left section: Logo or Back button + title -->
      <div class="row items-center q-py-xs" style="min-width: 250px">
        <a href="/"
          ><img src="/favicon.ico" class="header-logo" v-if="!parentRoute"
        /></a>
        <q-btn
          class="q-mr-sm"
          v-if="parentRoute"
          outline
          color="black"
          label="Back"
          :to="parentRoute"
        />
        <div
          class="text-h5 text-no-wrap ellipsis text-bold text-black"
          data-testid="title"
        >
          {{ route.name }}
        </div>
      </div>

      <!-- Right section: Currency dropdown -->
      <div class="row items-center text-black">
        <q-tabs align="left" class="desktop-only">
          <q-route-tab to="/wallets" label="Wallets" />
          <q-route-tab to="/tutorial-faq" label="Tutorial & FAQ" />
        </q-tabs>

        <q-btn
          flat
          dense
          color="black"
          round
          icon="settings"
          aria-label="Settings"
          @click="showSettingsModal = !showSettingsModal"
        ></q-btn>

        <SettingsModal v-model:show-dialog="showSettingsModal" />
      </div>
    </q-toolbar>
    <div class="q-py-sm q-px-md" v-if="showBreadCrumbs">
      <BreadCrumbs />
    </div>
  </q-header>
</template>

<script setup lang="ts">
import { computed, ref, Ref } from 'vue';
import BreadCrumbs from '../bread-crumbs/BreadCrumbs.vue';
import { useRoute } from 'vue-router';
import SettingsModal from '../settings-modal/SettingsModal.vue';

const route = useRoute();

defineProps({
  showBreadCrumbs: Boolean,
});

const showSettingsModal: Ref<boolean> = ref(false);

const parentRoute = computed(() => {
  const parent = route.meta.parent;
  return typeof parent === 'function' ? parent(route) : undefined;
});
</script>

<style scoped>
.header-logo {
  height: 3rem;
  margin: 5px;
}
</style>
