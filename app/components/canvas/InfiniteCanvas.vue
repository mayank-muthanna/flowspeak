<script setup lang="ts">
import { api } from "../../../convex/_generated/api";
import CanvasElement from "~/components/elements/CanvasElement.vue";
import ConnectorLayer from "~/components/elements/ConnectorLayer.vue";
import AddElementPanel from "~/components/ui/AddElementPanel.vue";
import TopBar from "~/components/ui/TopBar.vue";
import { useAgentBridge } from "~/services/agentBridge";
import type {
  CanvasElement as ElementModel,
  CanvasElementType,
} from "~/types/canvas";

const props = defineProps<{
  roomId: string;
  sessionToken: string;
  code: string;
}>();

const canvasRef = ref<HTMLElement | null>(null);
const worldRef = ref<HTMLElement | null>(null);
const panelOpen = ref(false);

const state = useCanvasState();
const collab = useCollaboration({
  roomId: props.roomId,
  sessionToken: props.sessionToken,
});
const actions = useElementActions({
  roomId: props.roomId,
  sessionToken: props.sessionToken,
  currentUser: props.sessionToken,
});

const { data: activeUsers } = useConvexQuery(
  api.rooms.getActiveUserCount,
  () => ({
    roomId: props.roomId as never,
  }),
);

const nodeElements = computed(() =>
  collab.elements.value.filter(
    (item) => item.type !== "arrow" && item.type !== "connector",
  ),
);

const idToElement = computed(() => {
  const map = new Map<string, ElementModel>();
  collab.elements.value.forEach((item) => map.set(item.id, item));
  return map;
});

const pointer = reactive({
  mode: "idle" as "idle" | "panning" | "dragging",
  pointerId: -1,
  originX: 0,
  originY: 0,
  startX: 0,
  startY: 0,
  elementId: "",
  elementStarts: {} as Record<string, { x: number; y: number }>,
});

const worldStyle = computed(() => ({
  width: "50000px",
  height: "50000px",
  transform: `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`,
}));

const pointerWorld = (event: PointerEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return state.screenToWorld({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
};

const onWheel = (event: WheelEvent) => {
  event.preventDefault();
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const mouse = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  const before = state.screenToWorld(mouse);
  const delta = event.deltaY < 0 ? 0.1 : -0.1;
  state.setZoom(state.viewport.zoom + delta);
  const after = state.worldToScreen(before);
  state.viewport.x += mouse.x - after.x;
  state.viewport.y += mouse.y - after.y;
};

const onCanvasPointerDown = (event: PointerEvent) => {
  if (event.button !== 0 && event.button !== 1) return;
  canvasRef.value?.focus();
  const target = event.target as HTMLElement;
  if (
    target.closest(
      "button, input, textarea, select, label, a, [contenteditable='true']",
    )
  ) {
    return;
  }
  if (target.closest("[data-element]")) return;
  state.clearSelection();
  pointer.mode = "panning";
  pointer.pointerId = event.pointerId;
  pointer.startX = state.viewport.x;
  pointer.startY = state.viewport.y;
  pointer.originX = event.clientX;
  pointer.originY = event.clientY;
  canvasRef.value?.setPointerCapture(event.pointerId);
};

const onElementPointerDown = (event: PointerEvent, element: ElementModel) => {
  event.stopPropagation();
  canvasRef.value?.focus();
  const alreadySelected = state.selectedIds.value.includes(element.id);
  if (event.shiftKey) {
    state.toggleSelect(element.id);
  } else if (!alreadySelected) {
    state.selectOne(element.id);
  }

  const activeIds = event.shiftKey
    ? state.selectedIds.value
    : alreadySelected
      ? state.selectedIds.value
      : [element.id];
  pointer.mode = "dragging";
  pointer.pointerId = event.pointerId;
  pointer.originX = event.clientX;
  pointer.originY = event.clientY;
  pointer.elementId = element.id;
  pointer.elementStarts = {};
  activeIds.forEach((id) => {
    const found = idToElement.value.get(id);
    if (!found) return;
    pointer.elementStarts[id] = { x: found.position.x, y: found.position.y };
  });
  canvasRef.value?.setPointerCapture(event.pointerId);
};

const onPointerMove = async (event: PointerEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (rect) {
    const world = state.screenToWorld({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    void collab.broadcastCursor(world.x, world.y);
  }

  if (event.pointerId !== pointer.pointerId) return;
  if (pointer.mode === "panning") {
    state.viewport.x = pointer.startX + (event.clientX - pointer.originX);
    state.viewport.y = pointer.startY + (event.clientY - pointer.originY);
    return;
  }
  if (pointer.mode !== "dragging") return;

  const dx = (event.clientX - pointer.originX) / state.viewport.zoom;
  const dy = (event.clientY - pointer.originY) / state.viewport.zoom;

  for (const [id, start] of Object.entries(pointer.elementStarts)) {
    const next = state.snapPoint({ x: start.x + dx, y: start.y + dy });
    const current = idToElement.value.get(id);
    if (!current) continue;
    const optimistic = {
      ...current,
      position: next,
    };
    collab.commitOptimistic(optimistic);
    collab.queueMove(id, next, actions.moveElement);
  }
};

const onPointerUp = (event: PointerEvent) => {
  if (event.pointerId !== pointer.pointerId) return;
  pointer.mode = "idle";
  pointer.pointerId = -1;
  pointer.elementStarts = {};
};

const onDrop = async (event: DragEvent) => {
  event.preventDefault();
  const type = event.dataTransfer?.getData(
    "application/x-monochrome-element",
  ) as CanvasElementType;
  if (!type) return;
  const world = pointerWorld(event as unknown as PointerEvent);
  await createElementByType(type, world);
};

const createElementByType = async (
  type: CanvasElementType,
  at?: { x: number; y: number },
) => {
  const rect = canvasRef.value?.getBoundingClientRect();
  const centeredPosition = rect
    ? state.screenToWorld({
        x: rect.width / 2,
        y: rect.height / 2,
      })
    : { x: 120, y: 120 };
  const position = at ?? centeredPosition;
  if (type === "arrow" || type === "connector") {
    const selected = state.selectedIds.value.filter((id) =>
      idToElement.value.has(id),
    );
    const fallback = nodeElements.value.slice(0, 2).map((item) => item.id);
    const pair = selected.length >= 2 ? selected.slice(0, 2) : fallback;
    if (pair.length < 2) return;
    await actions.connectElements(pair[0], pair[1], {
      from: "center",
      to: "center",
    });
    return;
  }
  try {
    const created = await actions.createElement(type, position);
    collab.commitOptimistic(created);
  } catch (error) {
    console.error("Failed to create element", error);
  }
};

const onDeleteSelection = async () => {
  const targets = [...state.selectedIds.value];
  state.clearSelection();
  await Promise.all(targets.map((id) => actions.deleteElement(id)));
};

const onKeyDown = async (event: KeyboardEvent) => {
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    await onDeleteSelection();
  }
};

const onElementUpdate = async (element: ElementModel) => {
  collab.commitOptimistic(element);
  await actions.updateElement(element);
};

const onTableCell = async (
  id: string,
  row: number,
  column: number,
  value: string,
) => {
  await actions.updateTableCell(id, row, column, value);
};

const toggleSnap = () => {
  state.snapToGrid.value = !state.snapToGrid.value;
};

const bridge = useAgentBridge(() => collab.elements.value, {
  createElementFromAgent: actions.updateElement,
  updateElementFromAgent: actions.updateElement,
  deleteElementFromAgent: actions.deleteElement,
});

defineExpose({
  getCanvasGraph: bridge.getCanvasGraph,
  applyAgentChanges: bridge.applyAgentChanges,
  suggestLayout: bridge.suggestLayout,
  analyzeStructure: bridge.analyzeStructure,
});

onMounted(() => {
  canvasRef.value?.focus();
});
</script>

<template>
  <div
    ref="canvasRef"
    class="relative h-screen overflow-hidden bg-white text-black"
    @pointerdown="onCanvasPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @wheel="onWheel"
    @keydown="onKeyDown"
    @drop="onDrop"
    @dragover.prevent
    tabindex="0"
  >
    <TopBar
      :code="code"
      :active-users="activeUsers ?? 1"
      :snap-to-grid="state.snapToGrid.value"
      @toggle-snap="toggleSnap"
    />

    <div
      ref="worldRef"
      class="absolute left-0 top-0 origin-top-left"
      :style="worldStyle"
    >
      <div
        class="absolute inset-0 pointer-events-none"
        style="
          background-image: radial-gradient(#d4d4d4 1px, transparent 1px);
          background-size: 20px 20px;
        "
      ></div>

      <ConnectorLayer :elements="collab.elements.value as any" />

      <div v-for="element in nodeElements" :key="element.id" data-element>
        <CanvasElement
          :element="element as any"
          :selected="state.isSelected(element as any)"
          @pointerdown="onElementPointerDown"
          @update="onElementUpdate"
          @table-cell="onTableCell"
        />
      </div>
    </div>

    <div class="absolute inset-0 pointer-events-none">
      <div
        v-for="cursor in collab.cursors.value ?? []"
        :key="cursor.sessionToken"
        class="absolute pointer-events-none text-[10px]"
        :style="{
          transform: `translate(${state.worldToScreen({ x: cursor.x, y: cursor.y }).x}px, ${state.worldToScreen({ x: cursor.x, y: cursor.y }).y}px)`,
        }"
      >
        <div class="w-2 h-2 rounded-full bg-black"></div>
      </div>
    </div>

    <AddElementPanel
      v-model:open="panelOpen"
      @create-now="createElementByType"
    />
  </div>
</template>
