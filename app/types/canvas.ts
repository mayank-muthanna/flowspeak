export type CanvasElementType =
  | "rectangle"
  | "rounded"
  | "arrow"
  | "connector"
  | "text"
  | "table"
  | "sticky"
  | "freedraw";

export type Point = {
  x: number;
  y: number;
};

export type CanvasElementStyle = {
  color: string;
  opacity: number;
};

export type CanvasElement = {
  id: string;
  type: CanvasElementType;
  position: Point;
  size: {
    width: number;
    height: number;
  };
  style: CanvasElementStyle;
  content: Record<string, unknown>;
  metadata: {
    createdBy: string;
    createdAt: number;
    lastModified: number;
    relationships: string[];
  };
};

export type RoomSession = {
  roomId: string;
  code: string;
  sessionToken: string;
};
