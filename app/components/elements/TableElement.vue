<script setup lang="ts">
import type { CanvasElement } from "~/types/canvas";

const props = defineProps<{
  element: CanvasElement;
  surfaceColor: string;
  surfaceOpacity: number;
  lightText: boolean;
}>();

const emit = defineEmits<{
  cell: [row: number, column: number, value: string];
  resize: [rows: number, columns: number];
}>();

const rows = computed(() => Number(props.element.content.rows ?? 3));
const columns = computed(() => Number(props.element.content.columns ?? 3));
const data = computed(() => (Array.isArray(props.element.content.data) ? props.element.content.data as string[][] : []));

const surfaceStyle = computed(() => ({
  backgroundColor: props.surfaceColor,
  opacity: props.surfaceOpacity,
}));

const inputToneClass = computed(() => (props.lightText ? "text-white placeholder:text-white/70" : "text-black"));

const cellValue = (r: number, c: number) => data.value[r]?.[c] ?? "";

const handleInput = (r: number, c: number, event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  emit("cell", r, c, value);
};

const onPaste = (r: number, c: number, event: ClipboardEvent) => {
  const pasted = event.clipboardData?.getData("text/plain");
  if (!pasted) return;
  event.preventDefault();
  const lines = pasted.split(/\r?\n/);
  lines.forEach((line, rowOffset) => {
    line.split("\t").forEach((token, colOffset) => {
      emit("cell", r + rowOffset, c + colOffset, token);
    });
  });
};
</script>

<template>
  <div class="w-full h-full flex flex-col border border-zinc-300" :style="surfaceStyle">
    <div
      class="flex items-center justify-end gap-2 p-1 border-b border-zinc-300/60"
      :class="lightText ? 'bg-black/20' : 'bg-white/65'"
    >
      <button
        class="text-[11px] px-2 py-1 border border-zinc-300/70 hover:bg-white/25"
        :class="inputToneClass"
        @click="emit('resize', rows + 1, columns)"
      >
        + Row
      </button>
      <button
        class="text-[11px] px-2 py-1 border border-zinc-300/70 hover:bg-white/25"
        :class="inputToneClass"
        @click="emit('resize', rows, columns + 1)"
      >
        + Col
      </button>
    </div>
    <div class="overflow-auto flex-1">
      <table class="min-w-full border-collapse text-xs">
        <tbody>
          <tr v-for="r in rows" :key="`r-${r}`">
            <td
              v-for="c in columns"
              :key="`c-${c}`"
              class="border border-zinc-300/60 p-0 min-w-24"
            >
              <input
                :value="cellValue(r - 1, c - 1)"
                class="w-full px-2 py-1.5 outline-none select-text bg-transparent"
                :class="inputToneClass"
                @input="(event) => handleInput(r - 1, c - 1, event)"
                @paste="(event) => onPaste(r - 1, c - 1, event)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
