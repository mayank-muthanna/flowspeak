<script setup lang="ts">
import type { CanvasElementType } from "~/types/canvas";

const open = defineModel<boolean>("open", { required: true });

const items: { type: CanvasElementType; label: string }[] = [
  { type: "rectangle", label: "Rectangle" },
  { type: "rounded", label: "Rounded Box" },
  { type: "arrow", label: "Arrow" },
  { type: "text", label: "Text Block" },
  { type: "table", label: "Table Block" },
  { type: "sticky", label: "Sticky Block" },
  { type: "freedraw", label: "Free Draw" },
];

const onDragStart = (event: DragEvent, type: CanvasElementType) => {
  event.dataTransfer?.setData("application/x-monochrome-element", type);
  event.dataTransfer?.setData("text/plain", type);
};

const emit = defineEmits<{
  createNow: [type: CanvasElementType];
}>();
</script>

<template>
  <div class="absolute right-6 bottom-6 z-30">
    <button
      class="w-16 h-16 rounded-full bg-black text-white text-4xl leading-none pb-1"
      @click="open = !open"
      aria-label="Add element"
    >
      +
    </button>
  </div>

  <transition name="slide-up">
    <section
      v-if="open"
      class="absolute left-0 right-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur-sm"
    >
      <div class="max-w-5xl mx-auto p-4">
        <p class="text-xs text-zinc-500 mb-3">Drag to canvas or click to add at center</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            v-for="item in items"
            :key="item.type"
            draggable="true"
            class="text-left text-sm px-3 py-2 border border-zinc-300 bg-white hover:bg-zinc-100"
            @dragstart="(event) => onDragStart(event, item.type)"
            @click="emit('createNow', item.type)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </section>
  </transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
