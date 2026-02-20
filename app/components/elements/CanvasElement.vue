<script setup lang="ts">
import type { CanvasElement } from "~/types/canvas";
import TableElement from "~/components/elements/TableElement.vue";

const props = defineProps<{
  element: CanvasElement;
  selected: boolean;
}>();

const emit = defineEmits<{
  pointerdown: [event: PointerEvent, element: CanvasElement];
  update: [element: CanvasElement];
  tableCell: [id: string, row: number, column: number, value: string];
}>();

const textValue = computed({
  get: () => String(props.element.content.text ?? ""),
  set: (value: string) => {
    emit("update", {
      ...props.element,
      content: {
        ...props.element.content,
        text: value,
      },
    });
  },
});

const polyline = computed(() => {
  const points = (props.element.content.points as { x: number; y: number }[] | undefined) ?? [];
  return points.map((point) => `${point.x},${point.y}`).join(" ");
});

const containerClasses = computed(() => {
  const base = [
    "absolute",
    "border",
    "border-zinc-300",
    "bg-white",
    "text-black",
    "text-sm",
    "select-none",
  ];
  if (props.selected) base.push("ring-1", "ring-black");
  if (props.element.type === "rounded") base.push("rounded-xl");
  if (props.element.type === "sticky") base.push("bg-zinc-100");
  if (props.element.type === "text") base.push("border-dashed");
  return base.join(" ");
});

const styleObject = computed(() => ({
  left: `${props.element.position.x}px`,
  top: `${props.element.position.y}px`,
  width: `${props.element.size.width}px`,
  height: `${props.element.size.height}px`,
}));

const applyTableResize = (rows: number, columns: number) => {
  emit("update", {
    ...props.element,
    content: {
      ...props.element.content,
      rows,
      columns,
    },
  });
};

const showsDragHandle = computed(() => {
  return (
    props.element.type === "text" ||
    props.element.type === "sticky" ||
    props.element.type === "table"
  );
});
</script>

<template>
  <div
    :class="containerClasses"
    :style="styleObject"
    @pointerdown="(event) => emit('pointerdown', event, element)"
  >
    <div
      v-if="showsDragHandle"
      data-drag-handle
      class="absolute top-1 left-1 z-10 h-5 px-2 border border-zinc-300 bg-white/90 text-[10px] leading-5 cursor-move"
    >
      Drag
    </div>

    <template v-if="element.type === 'rectangle' || element.type === 'rounded'">
      <div class="w-full h-full p-3 text-xs text-zinc-700">
        Box
      </div>
    </template>

    <template v-else-if="element.type === 'text' || element.type === 'sticky'">
      <textarea
        v-model="textValue"
        class="w-full h-full resize-none bg-transparent p-3 pt-8 outline-none text-sm select-text"
      />
    </template>

    <template v-else-if="element.type === 'table'">
      <TableElement
        :element="element"
        @cell="(row, column, value) => emit('tableCell', element.id, row, column, value)"
        @resize="applyTableResize"
      />
    </template>

    <template v-else-if="element.type === 'freedraw'">
      <svg class="w-full h-full">
        <polyline
          :points="polyline"
          fill="none"
          stroke="black"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </template>
  </div>
</template>
