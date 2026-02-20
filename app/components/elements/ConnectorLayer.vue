<script setup lang="ts">
import type { CanvasElement } from "~/types/canvas";

const props = defineProps<{
  elements: CanvasElement[];
}>();

const nodes = computed(() => {
  const map = new Map<string, CanvasElement>();
  props.elements.forEach((element) => map.set(element.id, element));
  return map;
});

const connectors = computed(() =>
  props.elements.filter((element) => element.type === "arrow" || element.type === "connector"),
);

const toCenter = (element: CanvasElement) => ({
  x: element.position.x + element.size.width / 2,
  y: element.position.y + element.size.height / 2,
});

const lineFor = (connector: CanvasElement) => {
  const fromId = String(connector.content.fromId ?? "");
  const toId = String(connector.content.toId ?? "");
  const from = nodes.value.get(fromId);
  const to = nodes.value.get(toId);
  if (!from || !to) return null;
  return {
    id: connector.id,
    from: toCenter(from),
    to: toCenter(to),
    isArrow: connector.type === "arrow",
  };
};
</script>

<template>
  <svg class="absolute inset-0 pointer-events-none overflow-visible">
    <defs>
      <marker
        id="arrowhead"
        markerWidth="8"
        markerHeight="8"
        refX="7"
        refY="4"
        orient="auto"
      >
        <path d="M0,0 L8,4 L0,8 z" fill="black" />
      </marker>
    </defs>
    <template v-for="connector in connectors" :key="connector.id">
      <line
        v-if="lineFor(connector)"
        :x1="lineFor(connector)?.from.x"
        :y1="lineFor(connector)?.from.y"
        :x2="lineFor(connector)?.to.x"
        :y2="lineFor(connector)?.to.y"
        stroke="black"
        stroke-width="1.4"
        :marker-end="lineFor(connector)?.isArrow ? 'url(#arrowhead)' : undefined"
      />
    </template>
  </svg>
</template>
