<template>
  <q-dialog
    :model-value="showDialog"
    @update:model-value="closeDialog"
    persistent
  >
    <q-card>
      <q-card-section class="text-center">
        <q-btn
          color="primary"
          label="Connect Wallet"
          data-testid="submit"
          @click="showWalletSelectionDialog()"
        />
      </q-card-section>
      <q-card-section class="text-center">
        <div>- OR -</div>
      </q-card-section>
      <q-card-section class="text-center flex row justify-center">
        <address-input v-model="store.address" @enter-pressed="addWallet()" />
        <q-btn
          color="primary"
          label="Add"
          class="q-ml-lg-xs q-ml-md-xs q-ml-xl-xs q-ml-sm-xs q-mt-xs-xs"
          data-testid="submit"
          @click="addWallet()"
          :disable="isDisabled"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="closeDialog" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import AddressInput from '../../../shared-module/components/address-input/AddressInput.vue';
import { computed } from 'vue';
import { isValidAddress } from '../../../shared-module/util/is-valid-address';
import { useSharedStore } from '../../../shared-module/store/shared.store';

const store = useSharedStore();

defineProps({
  showDialog: Boolean,
});

const isDisabled = computed(() => {
  return !isValidAddress(store.address?.trim());
});

const emit = defineEmits([
  'update:showDialog',
  'showWalletSelectionDialog',
  'addWallet',
]);

function showWalletSelectionDialog() {
  emit('update:showDialog', false);
  emit('showWalletSelectionDialog', false);
}

async function addWallet() {
  emit('update:showDialog', false);
  emit('addWallet');
}

async function closeDialog() {
  store.address = '';
  emit('update:showDialog', false);
}
</script>
