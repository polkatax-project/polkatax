<template>
  <q-layout view="hHh lpR fFf">
    <AppHeader show-bread-crumbs />
    <q-page-container style="min-height: 70vh">
      <router-view />
    </q-page-container>

    <q-dialog v-model="showErrorDialog">
      <q-card>
        <q-card-section class="q-pt-none q-mt-md">
          {{ errorMsg }}
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-footer elevated>
      <AppFooter />
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useSharedStore } from '../shared-module/store/shared.store';
import { Subscription } from 'rxjs';
import AppFooter from '../shared-module/components/app-footer/AppFooter.vue';
import AppHeader from '../shared-module/components/app-header/AppHeader.vue';

const showErrorDialog = ref(false);
const errorMsg = ref('');

const subscription: Subscription =
  useSharedStore().webSocketResponseError$.subscribe(handleError);

function handleError(err: any) {
  console.error(JSON.stringify(err));
  if (err.msg) {
    errorMsg.value = err.msg;
  } else {
    switch (err.code) {
      case 429:
        errorMsg.value = 'Too many requests. Please try again later.';
        break;
      case 400:
        errorMsg.value = 'The data sent to the server is invalid.';
        break;
      default:
        errorMsg.value =
          'There was an error connecting to the server. Please try again later.';
    }
  }
  showErrorDialog.value = true;
}

onBeforeUnmount(() => {
  subscription?.unsubscribe();
});
</script>
