# Monochrome Infinite Canvas

Production-structured Nuxt 3 + TailwindCSS + Convex monochrome infinite whiteboard.

## Features

- Infinite pan and zoom canvas
- Subtle dotted monochrome grid
- Drag-and-drop element creation from slide-up panel
- Rectangle, rounded box, text, sticky note, free draw, table, connectors/arrows
- Multi-select and delete
- Real-time sync with Convex (elements + cursors)
- Room creation with 6-digit room code
- 6-digit passcode join with hashed passcode storage
- Basic join/create rate limiting
- Agent bridge service layer for future Live AI integration

## Tech Stack

- Nuxt 3
- Vue 3 + TypeScript
- TailwindCSS
- Convex

## Project Structure

```txt
app/
  components/
    canvas/InfiniteCanvas.vue
    elements/CanvasElement.vue
    elements/ConnectorLayer.vue
    elements/TableElement.vue
    ui/AddElementPanel.vue
    ui/RoomAccessGate.vue
    ui/TopBar.vue
  composables/
    useCanvasState.ts
    useCollaboration.ts
    useElementActions.ts
    useRoom.ts
  pages/
    index.vue
    room/[code].vue
  services/agentBridge.ts
  types/canvas.ts
convex/
  schema.ts
  rooms.ts
  canvas.ts
  presence.ts
  lib/security.ts
```

## Convex Data Model

- `rooms`: metadata + hashed passcode + 6-digit room code
- `roomMembers`: room membership/session tokens and activity timestamps
- `elements`: graph-friendly serializable canvas objects
- `presence`: live cursor positions
- `rateLimits`: basic per-client join/create counters

Element shape:

```ts
{
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: Record<string, unknown>;
  metadata: {
    createdBy: string;
    createdAt: number;
    lastModified: number;
    relationships: string[];
  };
}
```

Connector content:

```ts
{
  fromId: string;
  toId: string;
  anchorPoints: Record<string, unknown>;
}
```

## Core Canvas Engine API

Defined in `app/composables/useElementActions.ts`:

- `createElement()`
- `updateElement()`
- `deleteElement()`
- `connectElements()`
- `updateTableCell()`
- `moveElement()`

These functions are reusable by UI and AI services.

## Agent Integration Surface

`app/services/agentBridge.ts` exposes:

- `getCanvasGraph()`
- `applyAgentChanges(changes)`
- `suggestLayout()`
- `analyzeStructure()`

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Start Convex (creates `.env.local` and generated API types):
```bash
npx convex dev
```

3. Start Nuxt:
```bash
npm run dev
```

4. Open:
```txt
http://localhost:3000
```

## Notes

- This workspace currently cannot reach npm in the execution sandbox, so dependency install/build could not be completed here.
- After `convex dev`, Convex generates `convex/_generated/*` used by the typed API imports.
