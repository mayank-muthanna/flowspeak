<script setup lang="ts">
defineProps<{
  code: string;
  activeUsers: number;
  snapToGrid: boolean;
}>();

defineEmits<{
  toggleSnap: [];
}>();
</script>

<template>
  <header class="absolute top-0 left-0 right-0 z-20 px-5 py-4 pointer-events-none">
    <div class="flex items-start justify-between">
      <div class="pointer-events-auto">
        <h1 class="text-sm tracking-wide font-medium">Monochrome Canvas</h1>
      </div>
      <div class="pointer-events-auto flex items-center gap-3 text-xs">
        <div class="px-3 py-1.5 border border-zinc-300 bg-white">Room {{ code }}</div>
        <div class="px-3 py-1.5 border border-zinc-300 bg-white">{{ activeUsers }} users</div>
        <button
          class="w-8 h-8 border border-zinc-300 bg-white text-base leading-none hover:bg-zinc-100"
          title="Toggle snap to grid"
          @click="$emit('toggleSnap')"
        >
          {{ snapToGrid ? "SN" : "NS" }}
        </button>
        <button class="w-8 h-8 border border-zinc-300 bg-white hover:bg-zinc-100" title="Settings">
          <svg viewBox="0 0 24 24" class="w-4 h-4 mx-auto" fill="none" stroke="black" stroke-width="1.6">
            <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M3 12h3M18 12h3M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>
