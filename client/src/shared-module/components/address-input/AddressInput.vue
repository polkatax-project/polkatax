<template>
  <div class="row items-center">
    <q-input
      class="address-input"
      filled
      no-error-icon
      :model-value="props.modelValue"
      @update:model-value="onAddressChanged"
      label="Enter Wallet address"
      data-testid="wallet-input"
      @keyup.enter="onEnterPressed"
      aria-describedby="wallet-info-tooltip"
      :rules="[
        (val) => !val || validateAddress(val) || 'Wallet address invalid',
      ]"
    >
      <template
        v-if="
          isValidAddress(props.modelValue) && !isEvmAddress && !isCanonicalAddress
        "
        v-slot:hint
      >
        <div class="text-caption text-grey-7 hint">
          Hint: All results are shown using the canonical address format. ({{
            convertToCanonicalAddress(props.modelValue.trim()).substring(0, 4)
          }}...)
        </div>
      </template>
      <template v-slot:after>
        <q-icon name="info" aria-describedby="wallet-info-tooltip">
          <q-tooltip
            anchor="top middle"
            self="bottom middle"
            :offset="[10, 10]"
            class="text-body2"
          >
            Copy the wallet address from your browser extension and paste it
            here
          </q-tooltip>
        </q-icon>
      </template>
    </q-input>
  </div>
</template>
<script setup lang="ts">
import 'vue';
import { computed } from 'vue';
import { isValidAddress, isValidEvmAddress } from '../../util/is-valid-address';
import {
  isCanonicalSubstrateAddress,
  convertToCanonicalAddress,
} from '../../util/convert-to-canonical-address';

const emits = defineEmits(['update:modelValue', 'enter-pressed']);

const props = defineProps({
  modelValue: String,
});

function onAddressChanged(value: string | number | null) {
  emits('update:modelValue', value ? String(value) : undefined);
}

function onEnterPressed() {
  emits('enter-pressed');
}

function validateAddress(adr: string) {
  return isValidAddress(adr.trim());
}

const isCanonicalAddress = computed(() => {
  return isCanonicalSubstrateAddress(props.modelValue.trim());
});

const isEvmAddress = computed(() => {
  return isValidEvmAddress(props.modelValue.trim());
});
</script>
<style lang="css" scoped>
.address-input {
  max-width: 250px;
  min-width: 250px;
  padding-bottom: 0;
}

.hint {
  white-space: nowrap;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  @media (max-width: 600px) {
    white-space: normal;
    width: 100%;
  }
}
</style>
