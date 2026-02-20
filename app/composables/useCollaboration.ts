import { api } from "../../convex/_generated/api";
import type { CanvasElement } from "~/types/canvas";

type CollaborationOptions = {
  roomId: string;
  sessionToken: string;
};

export function useCollaboration(options: CollaborationOptions) {
  const { data: remoteElements } = useConvexQuery(
    api.canvas.getElements,
    () => ({
      roomId: options.roomId as never,
    }),
  );
  const { data: cursors } = useConvexQuery(api.presence.getPresence, () => ({
    roomId: options.roomId as never,
    sessionToken: options.sessionToken,
  }));
  const heartbeatMutation = useConvexMutation(api.presence.heartbeat);

  const optimisticElements = ref<Record<string, CanvasElement>>({});
  const moveQueue = new Map<string, { x: number; y: number }>();
  let moveFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let cursorTick = 0;

  const elements = computed(() => {
    const base = (remoteElements.value ?? []) as CanvasElement[];
    const map = new Map(base.map((item) => [item.id, item]));
    for (const [id, optimistic] of Object.entries(optimisticElements.value)) {
      map.set(id, optimistic);
    }
    return Array.from(map.values());
  });

  const commitOptimistic = (element: CanvasElement) => {
    optimisticElements.value[element.id] = element;
    setTimeout(() => {
      delete optimisticElements.value[element.id];
    }, 800);
  };

  const queueMove = (
    elementId: string,
    position: { x: number; y: number },
    sender: (id: string, pos: { x: number; y: number }) => Promise<void>,
  ) => {
    moveQueue.set(elementId, position);
    if (moveFlushTimer) return;
    moveFlushTimer = setTimeout(async () => {
      const batch = [...moveQueue.entries()];
      moveQueue.clear();
      moveFlushTimer = null;
      await Promise.all(batch.map(([id, pos]) => sender(id, pos)));
    }, 40);
  };

  const broadcastCursor = async (x: number, y: number) => {
    cursorTick += 1;
    if (cursorTick % 3 !== 0) return;
    try {
      await heartbeatMutation.mutate({
        roomId: options.roomId as never,
        sessionToken: options.sessionToken,
        x,
        y,
      });
    } catch {
      // Ignore transient presence errors; canvas data remains authoritative.
    }
  };

  return {
    elements,
    cursors,
    commitOptimistic,
    queueMove,
    broadcastCursor,
  };
}
