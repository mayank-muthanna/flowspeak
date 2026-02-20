import { api } from "../../convex/_generated/api";
import type { CanvasElement, CanvasElementType, Point } from "~/types/canvas";

type ActionOptions = {
  roomId: string;
  sessionToken: string;
  currentUser: string;
};

function createBaseElement(
  type: CanvasElementType,
  at: Point,
  currentUser: string,
): CanvasElement {
  const now = Date.now();
  const base: CanvasElement = {
    id: crypto.randomUUID(),
    type,
    position: { ...at },
    size: { width: 180, height: 110 },
    content: {},
    metadata: {
      createdBy: currentUser,
      createdAt: now,
      lastModified: now,
      relationships: [],
    },
  };

  if (type === "text") base.content = { text: "Text" };
  if (type === "sticky") base.content = { text: "Sticky note" };
  if (type === "table") {
    base.size = { width: 360, height: 220 };
    base.content = {
      rows: 3,
      columns: 3,
      data: [
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
      ],
    };
  }
  if (type === "freedraw") {
    base.size = { width: 240, height: 120 };
    base.content = {
      points: [
        { x: 10, y: 70 },
        { x: 70, y: 30 },
        { x: 130, y: 90 },
        { x: 210, y: 45 },
      ],
    };
  }

  return base;
}

export function useElementActions(options: ActionOptions) {
  const upsertMutation = useConvexMutation(api.canvas.createOrUpdateElement);
  const moveMutation = useConvexMutation(api.canvas.moveElement);
  const deleteMutation = useConvexMutation(api.canvas.deleteElement);
  const connectMutation = useConvexMutation(api.canvas.connectElements);
  const updateTableMutation = useConvexMutation(api.canvas.updateTableCell);

  const createElement = async (type: CanvasElementType, at: Point) => {
    const element = createBaseElement(type, at, options.currentUser);
    void upsertMutation
      .mutate({
        roomId: options.roomId as never,
        sessionToken: options.sessionToken,
        element,
      })
      .catch((error) => {
        console.error("createElement mutation failed", error);
      });
    return element;
  };

  const updateElement = async (element: CanvasElement) => {
    await upsertMutation.mutate({
      roomId: options.roomId as never,
      sessionToken: options.sessionToken,
      element: {
        ...element,
        metadata: {
          ...element.metadata,
          lastModified: Date.now(),
        },
      },
    });
  };

  const deleteElement = async (elementId: string) => {
    await deleteMutation.mutate({
      roomId: options.roomId as never,
      sessionToken: options.sessionToken,
      elementId,
    });
  };

  const moveElement = async (elementId: string, position: Point) => {
    await moveMutation.mutate({
      roomId: options.roomId as never,
      sessionToken: options.sessionToken,
      elementId,
      position,
    });
  };

  const connectElements = async (
    fromId: string,
    toId: string,
    anchorPoints: Record<string, unknown>,
    connectorId = crypto.randomUUID(),
  ) => {
    await connectMutation.mutate({
      roomId: options.roomId as never,
      sessionToken: options.sessionToken,
      connectorId,
      fromId,
      toId,
      anchorPoints,
    });
  };

  const updateTableCell = async (
    elementId: string,
    rowIndex: number,
    columnIndex: number,
    value: string,
  ) => {
    await updateTableMutation.mutate({
      roomId: options.roomId as never,
      sessionToken: options.sessionToken,
      elementId,
      rowIndex,
      columnIndex,
      value,
    });
  };

  return {
    createElement,
    updateElement,
    deleteElement,
    moveElement,
    connectElements,
    updateTableCell,
  };
}
