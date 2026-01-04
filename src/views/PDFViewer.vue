<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  path: { type: String, required: true },
  modelValue: { type: Boolean, required: true },
});

const emit = defineEmits(["update:modelValue"]);
const loading = ref(true);
const error = ref(false);

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      loading.value = true;
      error.value = false;
    }
  },
  { immediate: true }
);

const close = () => {
  emit("update:modelValue", false);
};

const openInNewTab = () => {
  window.open(props.path, "_blank");
};

const handleIframeLoad = () => {
  loading.value = false;
};

const handleIframeError = () => {
  loading.value = false;
  error.value = true;
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="900px"
    fullscreen
  >
    <v-card>
      <v-toolbar dark color="primary">
        <v-btn icon dark @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <v-toolbar-title>Transcript PDF</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="white" variant="text" @click="openInNewTab" class="mr-2">
          <v-icon left>mdi-open-in-new</v-icon>
          Open in New Tab
        </v-btn>
      </v-toolbar>
      <v-card-text class="pa-0">
        <div
          v-if="loading"
          class="d-flex justify-center align-center"
          style="height: 80vh"
        >
          <v-progress-circular
            indeterminate
            color="primary"
          ></v-progress-circular>
        </div>
        <div
          v-else-if="error"
          class="d-flex justify-center align-center"
          style="height: 80vh"
        >
          <v-alert type="error" class="ma-4">
            Error loading PDF. Please try again.
          </v-alert>
        </div>
        <iframe
          v-show="!loading && !error"
          :src="path"
          width="100%"
          height="100%"
          style="border: none; min-height: 80vh"
          @load="handleIframeLoad"
          @error="handleIframeError"
        ></iframe>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.v-dialog--fullscreen {
  height: 90vh;
}
</style>
