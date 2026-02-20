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

  const localElements = ref<Record<string, CanvasElement>>({});
  const remoteElementsById = ref<Record<string, CanvasElement>>({});
  const dirtyUntil = new Map<string, number>();
  const holdReleaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const elementSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const moveQueue = new Map<string, { x: number; y: number }>();
  let moveFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let cursorTick = 0;

  const releaseLocalHold = (id: string) => {
    dirtyUntil.delete(id);
    const remote = remoteElementsById.value[id];
    if (remote) {
      localElements.value[id] = remote;
      return;
    }
    delete localElements.value[id];
  };

  const holdLocal = (id: string, holdMs: number) => {
    dirtyUntil.set(id, Date.now() + holdMs);
    const existingRelease = holdReleaseTimers.get(id);
    if (existingRelease) clearTimeout(existingRelease);
    holdReleaseTimers.set(
      id,
      setTimeout(() => {
        holdReleaseTimers.delete(id);
        releaseLocalHold(id);
      }, holdMs + 10),
    );
  };

  watch(
    remoteElements,
    (incoming) => {
      const next = (incoming ?? []) as CanvasElement[];
      const incomingIds = new Set<string>();
      const now = Date.now();
      const nextRemoteMap: Record<string, CanvasElement> = {};

      for (const element of next) {
        incomingIds.add(element.id);
        nextRemoteMap[element.id] = element;
        const hold = dirtyUntil.get(element.id) ?? 0;
        if (hold > now && localElements.value[element.id]) continue;
        localElements.value[element.id] = element;
      }
      remoteElementsById.value = nextRemoteMap;

      for (const id of Object.keys(localElements.value)) {
        if (incomingIds.has(id)) continue;
        const hold = dirtyUntil.get(id) ?? 0;
        if (hold > now) continue;
        delete localElements.value[id];
      }
    },
    { immediate: true },
  );

  const elements = computed(() => {
    return Object.values(localElements.value);
  });

  const commitOptimistic = (element: CanvasElement, holdMs = 4_000) => {
    localElements.value[element.id] = element;
    holdLocal(element.id, holdMs);
  };

  const removeOptimistic = (elementId: string, holdMs = 2_500) => {
    delete localElements.value[elementId];
    holdLocal(elementId, holdMs);
  };

  const scheduleElementSync = (
    element: CanvasElement,
    sender: (element: CanvasElement) => Promise<void>,
    delayMs = 350,
  ) => {
    commitOptimistic(element, 5_000);
    const existingTimer = elementSyncTimers.get(element.id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      elementSyncTimers.delete(element.id);
      try {
        await sender(element);
      } catch (error) {
        console.error("element sync failed", error);
      }
    }, delayMs);
    elementSyncTimers.set(element.id, timer);
  };

  const queueMove = (
    elementId: string,
    position: { x: number; y: number },
    sender: (id: string, pos: { x: number; y: number }) => Promise<void>,
    delayMs = 140,
    holdMs = 900,
  ) => {
    moveQueue.set(elementId, position);
    holdLocal(elementId, holdMs);

    if (moveFlushTimer) {
      clearTimeout(moveFlushTimer);
    }

    moveFlushTimer = setTimeout(async () => {
      const batch = [...moveQueue.entries()];
      moveQueue.clear();
      moveFlushTimer = null;
      await Promise.all(
        batch.map(([id, pos]) =>
          sender(id, pos).catch((error) => {
            console.error("move sync failed", error);
          }),
        ),
      );
    }, delayMs);
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

  const pingPresence = async (x: number, y: number) => {
    try {
      await heartbeatMutation.mutate({
        roomId: options.roomId as never,
        sessionToken: options.sessionToken,
        x,
        y,
      });
    } catch {
      // Ignore transient presence errors.
    }
  };

  onBeforeUnmount(() => {
    for (const timer of holdReleaseTimers.values()) clearTimeout(timer);
    holdReleaseTimers.clear();
    for (const timer of elementSyncTimers.values()) clearTimeout(timer);
    elementSyncTimers.clear();
    if (moveFlushTimer) {
      clearTimeout(moveFlushTimer);
      moveFlushTimer = null;
    }
  });

  return {
    elements,
    cursors,
    commitOptimistic,
    removeOptimistic,
    scheduleElementSync,
    queueMove,
    broadcastCursor,
    pingPresence,
  };
}
