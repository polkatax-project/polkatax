<template>
  <q-dialog
    :model-value="showDialog"
    @update:model-value="closeDialog"
    persistent
  >
    <q-card style="width: 50%; max-width: 400px">
      <q-card-section>
        <div class="text-h6">Settings</div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="row justify-between items-center">
          <div>Currency</div>
          <CurrencyDropdown />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="closeDialog" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import CurrencyDropdown from './currency-dropdown/CurrencyDropdown.vue';

const emit = defineEmits(['update:showDialog']);

defineProps({
  showDialog: Boolean,
});

async function closeDialog() {
  emit('update:showDialog', false);
}
</script>
