import type { CanvasElement, Point } from "~/types/canvas";

export function useCanvasState() {
  const viewport = reactive({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const selectedIds = ref<string[]>([]);
  const snapToGrid = ref(false);
  const gridSize = 20;

  const setZoom = (nextZoom: number) => {
    viewport.zoom = Math.max(0.25, Math.min(2.5, nextZoom));
  };

  const screenToWorld = (screen: Point): Point => {
    return {
      x: (screen.x - viewport.x) / viewport.zoom,
      y: (screen.y - viewport.y) / viewport.zoom,
    };
  };

  const worldToScreen = (world: Point): Point => {
    return {
      x: world.x * viewport.zoom + viewport.x,
      y: world.y * viewport.zoom + viewport.y,
    };
  };

  const snapPoint = (point: Point): Point => {
    if (!snapToGrid.value) return point;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  };

  const selectOne = (id: string) => {
    selectedIds.value = [id];
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((item) => item !== id);
      return;
    }
    selectedIds.value = [...selectedIds.value, id];
  };

  const clearSelection = () => {
    selectedIds.value = [];
  };

  const isSelected = (element: CanvasElement) => {
    return selectedIds.value.includes(element.id);
  };

  return {
    viewport,
    selectedIds,
    snapToGrid,
    setZoom,
    screenToWorld,
    worldToScreen,
    snapPoint,
    selectOne,
    toggleSelect,
    clearSelection,
    isSelected,
  };
}
