<script setup lang="ts">
import type { CanvasElement } from "~/types/canvas";
import TableElement from "~/components/elements/TableElement.vue";

const props = defineProps<{
  element: CanvasElement;
  selected: boolean;
  zoom: number;
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
  const points =
    (props.element.content.points as { x: number; y: number }[] | undefined) ??
    [];
  return points.map((point) => `${point.x},${point.y}`).join(" ");
});

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const MIN_WIDTH = 80;
const MIN_HEIGHT = 60;

const defaultColor = computed(() => {
  if (props.element.type === "sticky") return "#fef08a";
  if (props.element.type === "freedraw") return "#111111";
  return "#ffffff";
});

const resolvedStyle = computed(() => {
  const style = props.element.style as
    | { color?: unknown; opacity?: unknown }
    | undefined;
  const color =
    typeof style?.color === "string" && HEX_COLOR_REGEX.test(style.color)
      ? style.color
      : defaultColor.value;
  const rawOpacity =
    typeof style?.opacity === "number" ? style.opacity : Number(style?.opacity);
  const opacity = Number.isFinite(rawOpacity) ? clamp(rawOpacity, 0.05, 1) : 1;
  return { color, opacity };
});

const usesLightText = computed(() => {
  if (props.element.type === "freedraw") return false;
  const hex = resolvedStyle.value.color.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const perceivedBrightness = (r * 299 + g * 587 + b * 114) / 1000;
  return perceivedBrightness < 135 && resolvedStyle.value.opacity > 0.45;
});

const contentToneClass = computed(() =>
  usesLightText.value ? "text-white" : "text-black",
);

const surfaceStyle = computed(() => {
  if (props.element.type === "freedraw") {
    return {
      opacity: resolvedStyle.value.opacity,
    };
  }
  return {
    backgroundColor: resolvedStyle.value.color,
    opacity: resolvedStyle.value.opacity,
  };
});

const containerClasses = computed(() => {
  const base = [
    "absolute",
    "border",
    "border-zinc-300",
    "text-sm",
    "select-none",
    "overflow-hidden",
  ];
  if (props.selected) base.push("ring-1", "ring-black");
  if (props.element.type === "rounded") base.push("rounded-xl");
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

const resizeState = reactive({
  active: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0,
});

const clearResizeListeners = () => {
  if (typeof window === "undefined") return;
  window.removeEventListener("pointermove", onResizePointerMove);
  window.removeEventListener("pointerup", onResizePointerUp);
  window.removeEventListener("pointercancel", onResizePointerUp);
};

const stopResizing = () => {
  resizeState.active = false;
  resizeState.pointerId = -1;
  clearResizeListeners();
};

const onResizePointerMove = (event: PointerEvent) => {
  if (!resizeState.active || event.pointerId !== resizeState.pointerId) return;
  event.preventDefault();

  const zoom = Math.max(props.zoom || 1, 0.1);
  const dx = (event.clientX - resizeState.startX) / zoom;
  const dy = (event.clientY - resizeState.startY) / zoom;
  const width = Math.max(MIN_WIDTH, Math.round(resizeState.startWidth + dx));
  const height = Math.max(MIN_HEIGHT, Math.round(resizeState.startHeight + dy));

  if (
    width === props.element.size.width &&
    height === props.element.size.height
  )
    return;
  emit("update", {
    ...props.element,
    size: {
      width,
      height,
    },
  });
};

const onResizePointerUp = (event: PointerEvent) => {
  if (!resizeState.active || event.pointerId !== resizeState.pointerId) return;
  stopResizing();
};

const onResizePointerDown = (event: PointerEvent) => {
  event.stopPropagation();
  event.preventDefault();
  resizeState.active = true;
  resizeState.pointerId = event.pointerId;
  resizeState.startX = event.clientX;
  resizeState.startY = event.clientY;
  resizeState.startWidth = props.element.size.width;
  resizeState.startHeight = props.element.size.height;

  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", onResizePointerMove);
    window.addEventListener("pointerup", onResizePointerUp);
    window.addEventListener("pointercancel", onResizePointerUp);
  }
};

onBeforeUnmount(() => {
  stopResizing();
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
      <div
        class="w-full h-full p-3 text-xs"
        :class="contentToneClass"
        :style="surfaceStyle"
      ></div>
    </template>

    <template v-else-if="element.type === 'text' || element.type === 'sticky'">
      <textarea
        v-model="textValue"
        class="w-full h-full resize-none bg-transparent p-3 pt-8 outline-none text-sm select-text"
        :class="contentToneClass"
        :style="surfaceStyle"
      />
    </template>

    <template v-else-if="element.type === 'table'">
      <TableElement
        :element="element"
        :surface-color="resolvedStyle.color"
        :surface-opacity="resolvedStyle.opacity"
        :light-text="usesLightText"
        @cell="
          (row, column, value) =>
            emit('tableCell', element.id, row, column, value)
        "
        @resize="applyTableResize"
      />
    </template>

    <template v-else-if="element.type === 'freedraw'">
      <svg class="w-full h-full" :style="surfaceStyle">
        <polyline
          :points="polyline"
          fill="none"
          :stroke="resolvedStyle.color"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </template>

    <button
      v-if="selected"
      type="button"
      class="absolute right-0 bottom-0 z-20 h-3 w-3 cursor-se-resize border-l border-t border-zinc-400 bg-white/95"
      title="Resize element"
      @pointerdown="onResizePointerDown"
    />
  </div>
</template>
