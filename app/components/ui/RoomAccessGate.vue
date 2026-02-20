<script setup lang="ts">
const props = defineProps<{
  code: string;
  loading?: boolean;
  error?: string;
}>();

const passcode = ref("");
const name = ref("");

const emit = defineEmits<{
  submit: [passcode: string, name?: string];
}>();

const submit = () => {
  emit("submit", passcode.value, name.value || undefined);
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white">
    <div class="w-full max-w-md border border-zinc-300 bg-white p-6">
      <h1 class="text-lg font-medium mb-1">Join Room {{ props.code }}</h1>
      <p class="text-sm text-zinc-500 mb-5">Enter the 6-digit passcode.</p>
      <input
        v-model="name"
        placeholder="Display name (optional)"
        class="w-full mb-3 border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
      />
      <input
        v-model="passcode"
        inputmode="numeric"
        maxlength="6"
        placeholder="Passcode"
        class="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black tracking-[0.3em]"
      />
      <p v-if="error" class="text-xs text-black mt-3">{{ error }}</p>
      <button
        class="w-full mt-4 bg-black text-white py-2 text-sm disabled:opacity-70"
        :disabled="loading"
        @click="submit"
      >
        {{ loading ? "Joining..." : "Join Room" }}
      </button>
    </div>
  </div>
</template>
