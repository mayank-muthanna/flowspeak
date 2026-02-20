<script setup lang="ts">
import { api } from "../../../convex/_generated/api";
import CanvasElement from "~/components/elements/CanvasElement.vue";
import AddElementPanel from "~/components/ui/AddElementPanel.vue";
import TopBar from "~/components/ui/TopBar.vue";
import { useAgentBridge } from "~/services/agentBridge";
import type {
  CanvasElement as ElementModel,
  CanvasElementType,
  Point,
} from "~/types/canvas";

type ArrowStyle = "straight" | "curved";
type ArrowEndpoint =
  | { mode: "point"; x: number; y: number }
  | { mode: "element"; elementId: string };

type NormalizedArrowContent = {
  style: ArrowStyle;
  from: ArrowEndpoint;
  to: ArrowEndpoint;
  controlPoints: Point[];
};

type ArrowView = {
  id: string;
  element: ElementModel;
  content: NormalizedArrowContent;
  path: string;
  polylinePoints: Point[];
  segmentMidpoints: { x: number; y: number; insertIndex: number }[];
  start: Point;
  end: Point;
};

const props = defineProps<{
  roomId: string;
  sessionToken: string;
  code: string;
}>();

const canvasRef = ref<HTMLElement | null>(null);
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

const isArrowElement = (element: ElementModel) =>
  element.type === "arrow" || element.type === "connector";

const elementCenter = (element: ElementModel): Point => ({
  x: element.position.x + element.size.width / 2,
  y: element.position.y + element.size.height / 2,
});

const resolveEndpoint = (endpoint: ArrowEndpoint): Point | null => {
  if (endpoint.mode === "point") {
    return { x: endpoint.x, y: endpoint.y };
  }
  const boundElement = idToElement.value.get(endpoint.elementId);
  if (!boundElement) return null;
  return elementCenter(boundElement);
};

const defaultCurveControl = (start: Point, end: Point): Point => ({
  x: (start.x + end.x) / 2,
  y: (start.y + end.y) / 2 - 70,
});

const normalizeArrowContent = (element: ElementModel): NormalizedArrowContent => {
  const content = (element.content ?? {}) as Record<string, unknown>;
  const rawFrom = content.from as Record<string, unknown> | undefined;
  const rawTo = content.to as Record<string, unknown> | undefined;

  let from: ArrowEndpoint;
  let to: ArrowEndpoint;

  if (rawFrom?.mode === "element" && typeof rawFrom.elementId === "string") {
    from = { mode: "element", elementId: rawFrom.elementId };
  } else if (typeof content.fromId === "string") {
    from = { mode: "element", elementId: content.fromId };
  } else {
    from = {
      mode: "point",
      x: Number(rawFrom?.x ?? content.fromX ?? element.position.x),
      y: Number(rawFrom?.y ?? content.fromY ?? element.position.y),
    };
  }

  if (rawTo?.mode === "element" && typeof rawTo.elementId === "string") {
    to = { mode: "element", elementId: rawTo.elementId };
  } else if (typeof content.toId === "string") {
    to = { mode: "element", elementId: content.toId };
  } else {
    to = {
      mode: "point",
      x: Number(rawTo?.x ?? content.toX ?? element.position.x + 220),
      y: Number(rawTo?.y ?? content.toY ?? element.position.y + 120),
    };
  }

  const style: ArrowStyle = content.style === "curved" ? "curved" : "straight";
  const controlPoints = Array.isArray(content.controlPoints)
    ? content.controlPoints
        .map((point) => {
          const item = point as Record<string, unknown>;
          const x = Number(item.x);
          const y = Number(item.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          return { x, y };
        })
        .filter((point): point is Point => point !== null)
    : [];

  if (style === "curved" && controlPoints.length === 0) {
    const start = resolveEndpoint(from);
    const end = resolveEndpoint(to);
    if (start && end) {
      controlPoints.push(defaultCurveControl(start, end));
    }
  }

  return {
    style,
    from,
    to,
    controlPoints,
  };
};

const serializeArrowContent = (content: NormalizedArrowContent) => {
  return {
    style: content.style,
    from: content.from,
    to: content.to,
    controlPoints: content.controlPoints,
    fromId: content.from.mode === "element" ? content.from.elementId : null,
    toId: content.to.mode === "element" ? content.to.elementId : null,
    anchorPoints: {
      from: content.from,
      to: content.to,
    },
  };
};

const orthogonalize = (points: Point[]): Point[] => {
  if (points.length <= 1) return points;
  const out: Point[] = [{ ...points[0] }];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    const next = points[i];
    if (prev.x === next.x || prev.y === next.y) {
      out.push({ ...next });
      continue;
    }
    out.push({ x: next.x, y: prev.y });
    out.push({ ...next });
  }
  const deduped: Point[] = [];
  for (const point of out) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.x !== point.x || prev.y !== point.y) {
      deduped.push(point);
    }
  }
  return deduped;
};

const straightPathFromPoints = (points: Point[]) => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
    )
    .join(" ");
};

const curvedPathFromPoints = (start: Point, controls: Point[], end: Point) => {
  if (controls.length === 0) {
    const control = defaultCurveControl(start, end);
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }

  if (controls.length === 1) {
    const c = controls[0];
    return `M ${start.x} ${start.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`;
  }

  let path = `M ${start.x} ${start.y}`;
  for (let i = 0; i < controls.length; i += 1) {
    const cp = controls[i];
    const target =
      i === controls.length - 1
        ? end
        : {
            x: (cp.x + controls[i + 1].x) / 2,
            y: (cp.y + controls[i + 1].y) / 2,
          };
    path += ` Q ${cp.x} ${cp.y} ${target.x} ${target.y}`;
  }
  return path;
};

const arrowViews = computed(() => {
  const views: ArrowView[] = [];
  for (const element of collab.elements.value) {
    if (!isArrowElement(element)) continue;
    const content = normalizeArrowContent(element);
    const start = resolveEndpoint(content.from);
    const end = resolveEndpoint(content.to);
    if (!start || !end) continue;

    const basePoints = [start, ...content.controlPoints, end];
    const polylinePoints =
      content.style === "straight" ? orthogonalize(basePoints) : basePoints;
    const path =
      content.style === "straight"
        ? straightPathFromPoints(polylinePoints)
        : curvedPathFromPoints(start, content.controlPoints, end);

    const segmentMidpoints = polylinePoints.slice(0, -1).map((point, index) => {
      const next = polylinePoints[index + 1];
      return {
        x: (point.x + next.x) / 2,
        y: (point.y + next.y) / 2,
        insertIndex: index,
      };
    });

    views.push({
      id: element.id,
      element,
      content,
      path,
      polylinePoints,
      segmentMidpoints,
      start,
      end,
    });
  }
  return views;
});

const selectedArrow = computed(() => {
  if (state.selectedIds.value.length !== 1) return null;
  const selectedId = state.selectedIds.value[0];
  return arrowViews.value.find((arrow) => arrow.id === selectedId) ?? null;
});

const arrowTool = reactive({
  active: false,
  style: "straight" as ArrowStyle,
  firstEndpoint: null as ArrowEndpoint | null,
});

const hoverWorldPoint = ref<Point>({ x: 0, y: 0 });
const showArrowCursor = computed(
  () => arrowTool.active || Boolean(selectedArrow.value),
);

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

const controlDrag = reactive({
  active: false,
  pointerId: -1,
  arrowId: "",
  controlIndex: -1,
});

const tableCellSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let presenceTimer: ReturnType<typeof setInterval> | null = null;

const worldStyle = computed(() => ({
  width: "50000px",
  height: "50000px",
  transform: `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`,
}));

const pointerWorld = (event: PointerEvent): Point => {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return state.screenToWorld({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
};

const updateArrowElement = async (
  element: ElementModel,
  content: NormalizedArrowContent,
  delayMs = 220,
) => {
  const updated: ElementModel = {
    ...element,
    type: "arrow",
    content: serializeArrowContent(content),
    metadata: {
      ...element.metadata,
      relationships: [
        content.from.mode === "element" ? content.from.elementId : "",
        content.to.mode === "element" ? content.to.elementId : "",
      ].filter(Boolean),
      lastModified: Date.now(),
    },
  };
  collab.scheduleElementSync(updated, actions.updateElement, delayMs);
};

const createArrowBetweenEndpoints = async (
  from: ArrowEndpoint,
  to: ArrowEndpoint,
  style: ArrowStyle,
) => {
  const now = Date.now();
  const content: NormalizedArrowContent = {
    style,
    from,
    to,
    controlPoints: [],
  };

  const start = resolveEndpoint(from);
  const end = resolveEndpoint(to);
  if (style === "curved" && start && end) {
    content.controlPoints = [defaultCurveControl(start, end)];
  }

  const element: ElementModel = {
    id: crypto.randomUUID(),
    type: "arrow",
    position: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    content: serializeArrowContent(content),
    metadata: {
      createdBy: props.sessionToken,
      createdAt: now,
      lastModified: now,
      relationships: [
        from.mode === "element" ? from.elementId : "",
        to.mode === "element" ? to.elementId : "",
      ].filter(Boolean),
    },
  };

  collab.commitOptimistic(element, 6_000);
  try {
    await actions.updateElement(element);
  } catch (error) {
    console.error("Failed to create arrow", error);
  }
};

const handleArrowPlacement = async (endpoint: ArrowEndpoint) => {
  if (!arrowTool.firstEndpoint) {
    arrowTool.firstEndpoint = endpoint;
    return;
  }
  await createArrowBetweenEndpoints(
    arrowTool.firstEndpoint,
    endpoint,
    arrowTool.style,
  );
  arrowTool.firstEndpoint = null;
};

const setArrowStyle = async (style: ArrowStyle) => {
  arrowTool.style = style;
  const selected = selectedArrow.value;
  if (!selected) return;
  const nextContent: NormalizedArrowContent = {
    ...selected.content,
    style,
    controlPoints: [...selected.content.controlPoints],
  };

  if (style === "curved" && nextContent.controlPoints.length === 0) {
    nextContent.controlPoints.push(defaultCurveControl(selected.start, selected.end));
  }

  await updateArrowElement(selected.element, nextContent, 120);
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

const onCanvasPointerDown = async (event: PointerEvent) => {
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

  if (arrowTool.active) {
    event.preventDefault();
    const world = pointerWorld(event);
    await handleArrowPlacement({ mode: "point", x: world.x, y: world.y });
    return;
  }

  if (target.closest("[data-element]")) return;
  event.preventDefault();
  state.clearSelection();
  pointer.mode = "panning";
  pointer.pointerId = event.pointerId;
  pointer.startX = state.viewport.x;
  pointer.startY = state.viewport.y;
  pointer.originX = event.clientX;
  pointer.originY = event.clientY;
  canvasRef.value?.setPointerCapture(event.pointerId);
};

const onElementPointerDown = async (event: PointerEvent, element: ElementModel) => {
  event.stopPropagation();
  canvasRef.value?.focus();
  const target = event.target as HTMLElement;

  if (arrowTool.active) {
    event.preventDefault();
    await handleArrowPlacement({ mode: "element", elementId: element.id });
    return;
  }

  if (isArrowElement(element)) return;

  if (target.closest("input, textarea, select, [contenteditable='true']")) {
    return;
  }

  if (
    (element.type === "text" || element.type === "sticky" || element.type === "table") &&
    !target.closest("[data-drag-handle]")
  ) {
    return;
  }

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
    if (!found || isArrowElement(found)) return;
    pointer.elementStarts[id] = { x: found.position.x, y: found.position.y };
  });
  canvasRef.value?.setPointerCapture(event.pointerId);
};

const onArrowPointerDown = (event: PointerEvent, arrowId: string) => {
  event.stopPropagation();
  event.preventDefault();
  canvasRef.value?.focus();
  state.selectOne(arrowId);
};

const startControlDrag = (
  event: PointerEvent,
  arrowId: string,
  controlIndex: number,
) => {
  event.stopPropagation();
  event.preventDefault();
  canvasRef.value?.focus();
  state.selectOne(arrowId);
  controlDrag.active = true;
  controlDrag.pointerId = event.pointerId;
  controlDrag.arrowId = arrowId;
  controlDrag.controlIndex = controlIndex;
  canvasRef.value?.setPointerCapture(event.pointerId);
};

const onArrowMidpointPointerDown = async (
  event: PointerEvent,
  arrowId: string,
  insertIndex: number,
) => {
  event.stopPropagation();
  event.preventDefault();
  const arrow = arrowViews.value.find((item) => item.id === arrowId);
  if (!arrow) return;

  const point = pointerWorld(event);
  const nextContent: NormalizedArrowContent = {
    ...arrow.content,
    controlPoints: [...arrow.content.controlPoints],
  };
  nextContent.controlPoints.splice(insertIndex, 0, point);
  await updateArrowElement(arrow.element, nextContent, 120);
  startControlDrag(event, arrowId, insertIndex);
};

const onPointerMove = async (event: PointerEvent) => {
  const world = pointerWorld(event);
  hoverWorldPoint.value = world;
  void collab.broadcastCursor(world.x, world.y);

  if (controlDrag.active && event.pointerId === controlDrag.pointerId) {
    const arrow = arrowViews.value.find((item) => item.id === controlDrag.arrowId);
    if (!arrow) return;

    const nextContent: NormalizedArrowContent = {
      ...arrow.content,
      controlPoints: [...arrow.content.controlPoints],
    };
    if (!nextContent.controlPoints[controlDrag.controlIndex]) return;
    nextContent.controlPoints[controlDrag.controlIndex] = {
      x: world.x,
      y: world.y,
    };
    await updateArrowElement(arrow.element, nextContent, 140);
    return;
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
    collab.commitOptimistic(optimistic, 900);
    collab.queueMove(id, next, actions.moveElement);
  }
};

const onPointerUp = (event: PointerEvent) => {
  if (controlDrag.active && event.pointerId === controlDrag.pointerId) {
    controlDrag.active = false;
    controlDrag.pointerId = -1;
    controlDrag.arrowId = "";
    controlDrag.controlIndex = -1;
    return;
  }

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
  if (type === "arrow" || type === "connector") {
    panelOpen.value = false;
    arrowTool.active = true;
    arrowTool.style = type === "connector" ? "straight" : arrowTool.style;
    return;
  }

  const rect = canvasRef.value?.getBoundingClientRect();
  const centeredPosition = rect
    ? state.screenToWorld({
        x: rect.width / 2,
        y: rect.height / 2,
      })
    : { x: 120, y: 120 };
  const position = at ?? centeredPosition;

  try {
    const created = await actions.createElement(type, position);
    collab.commitOptimistic(created, 5_000);
  } catch (error) {
    console.error("Failed to create element", error);
  }
};

const onDeleteSelection = async () => {
  const targets = [...state.selectedIds.value];
  state.clearSelection();
  targets.forEach((id) => collab.removeOptimistic(id, 3_000));
  await Promise.all(
    targets.map((id) =>
      actions.deleteElement(id).catch((error) => {
        console.error("deleteElement failed", error);
      }),
    ),
  );
};

const onKeyDown = async (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    arrowTool.firstEndpoint = null;
    arrowTool.active = false;
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    await onDeleteSelection();
  }
};

const onElementUpdate = async (element: ElementModel) => {
  collab.scheduleElementSync(element, actions.updateElement, 350);
};

const onTableCell = async (
  id: string,
  row: number,
  column: number,
  value: string,
) => {
  const current = idToElement.value.get(id);
  if (current?.type === "table") {
    const currentData = Array.isArray(current.content.data)
      ? (current.content.data as string[][]).map((item) => [...item])
      : [];
    while (currentData.length <= row) currentData.push([]);
    while (currentData[row].length <= column) currentData[row].push("");
    currentData[row][column] = value;

    const updated: ElementModel = {
      ...current,
      content: {
        ...current.content,
        data: currentData,
        rows: Math.max(Number(current.content.rows ?? 0), currentData.length),
        columns: Math.max(
          Number(current.content.columns ?? 0),
          currentData.reduce((max, cells) => Math.max(max, cells.length), 0),
        ),
      },
      metadata: {
        ...current.metadata,
        lastModified: Date.now(),
      },
    };
    collab.commitOptimistic(updated, 5_000);
  }

  const syncKey = `${id}:${row}:${column}`;
  const existingTimer = tableCellSyncTimers.get(syncKey);
  if (existingTimer) clearTimeout(existingTimer);
  tableCellSyncTimers.set(
    syncKey,
    setTimeout(() => {
      tableCellSyncTimers.delete(syncKey);
      actions.updateTableCell(id, row, column, value).catch((error) => {
        console.error("updateTableCell failed", error);
      });
    }, 350),
  );
};

const toggleSnap = () => {
  state.snapToGrid.value = !state.snapToGrid.value;
};

const arrowDraftPath = computed(() => {
  if (!arrowTool.active || !arrowTool.firstEndpoint) return "";
  const start = resolveEndpoint(arrowTool.firstEndpoint);
  const end = hoverWorldPoint.value;
  if (!start || !end) return "";
  if (arrowTool.style === "straight") {
    const points = orthogonalize([start, end]);
    return straightPathFromPoints(points);
  }
  return curvedPathFromPoints(start, [defaultCurveControl(start, end)], end);
});

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
  void collab.pingPresence(hoverWorldPoint.value.x, hoverWorldPoint.value.y);
  presenceTimer = setInterval(() => {
    void collab.pingPresence(hoverWorldPoint.value.x, hoverWorldPoint.value.y);
  }, 5000);
});

onBeforeUnmount(() => {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
  for (const timer of tableCellSyncTimers.values()) {
    clearTimeout(timer);
  }
  tableCellSyncTimers.clear();
});
</script>

<template>
  <div
    ref="canvasRef"
    :class="[
      'relative h-screen overflow-hidden bg-white text-black select-none',
      arrowTool.active ? 'cursor-crosshair' : '',
    ]"
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
      v-if="arrowTool.active || selectedArrow"
      class="absolute z-30 top-14 right-5 border border-zinc-300 bg-white px-3 py-2 text-xs space-y-2"
    >
      <div class="flex items-center gap-2">
        <button
          class="px-2 py-1 border border-zinc-300"
          :class="(selectedArrow?.content.style ?? arrowTool.style) === 'straight' ? 'bg-black text-white' : ''"
          @click="setArrowStyle('straight')"
        >
          Straight
        </button>
        <button
          class="px-2 py-1 border border-zinc-300"
          :class="(selectedArrow?.content.style ?? arrowTool.style) === 'curved' ? 'bg-black text-white' : ''"
          @click="setArrowStyle('curved')"
        >
          Curved
        </button>
        <button
          class="px-2 py-1 border border-zinc-300"
          :class="arrowTool.active ? 'bg-zinc-100' : ''"
          @click="arrowTool.active = !arrowTool.active; arrowTool.firstEndpoint = null"
        >
          {{ arrowTool.active ? "Tool On" : "Tool Off" }}
        </button>
      </div>
      <p v-if="arrowTool.active" class="text-zinc-600">
        {{ arrowTool.firstEndpoint ? "Pick arrow head point or element." : "Pick arrow tail point or element." }}
      </p>
    </div>

    <div class="absolute left-0 top-0 origin-top-left" :style="worldStyle">
      <div
        class="absolute inset-0 pointer-events-none"
        style="
          background-image: radial-gradient(#d4d4d4 1px, transparent 1px);
          background-size: 20px 20px;
        "
      ></div>

      <svg class="absolute inset-0 overflow-visible">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="black" />
          </marker>
        </defs>

        <g v-for="arrow in arrowViews" :key="arrow.id">
          <path
            :d="arrow.path"
            fill="none"
            stroke="transparent"
            stroke-width="14"
            pointer-events="stroke"
            @pointerdown="(event) => onArrowPointerDown(event, arrow.id)"
          />
          <path
            :d="arrow.path"
            fill="none"
            stroke="black"
            stroke-width="1.6"
            marker-end="url(#arrowhead)"
            :class="selectedArrow?.id === arrow.id ? 'opacity-100' : 'opacity-85'"
          />

          <template v-if="selectedArrow?.id === arrow.id">
            <circle :cx="arrow.start.x" :cy="arrow.start.y" r="4.5" fill="#3f3f46" />
            <circle :cx="arrow.end.x" :cy="arrow.end.y" r="4.5" fill="#3f3f46" />

            <circle
              v-for="(point, index) in arrow.content.controlPoints"
              :key="`cp-${arrow.id}-${index}`"
              :cx="point.x"
              :cy="point.y"
              r="5.5"
              fill="white"
              stroke="black"
              stroke-width="1.3"
              class="cursor-move"
              @pointerdown="(event) => startControlDrag(event, arrow.id, index)"
            />

            <circle
              v-for="midpoint in arrow.segmentMidpoints"
              :key="`mid-${arrow.id}-${midpoint.insertIndex}`"
              :cx="midpoint.x"
              :cy="midpoint.y"
              r="4"
              fill="#52525b"
              class="cursor-copy"
              @pointerdown="(event) => onArrowMidpointPointerDown(event, arrow.id, midpoint.insertIndex)"
            />
          </template>
        </g>

        <path
          v-if="arrowDraftPath"
          :d="arrowDraftPath"
          fill="none"
          stroke="#52525b"
          stroke-width="1.3"
          stroke-dasharray="5 4"
          marker-end="url(#arrowhead)"
        />
      </svg>

      <div
        v-if="showArrowCursor"
        class="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-700 border border-white pointer-events-none"
        :style="{ left: `${hoverWorldPoint.x}px`, top: `${hoverWorldPoint.y}px` }"
      ></div>

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
