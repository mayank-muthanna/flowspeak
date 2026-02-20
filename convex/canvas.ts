import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ensureRoomMember } from "./lib/security";

const elementValidator = {
  id: v.string(),
  type: v.string(),
  position: v.object({
    x: v.number(),
    y: v.number(),
  }),
  size: v.object({
    width: v.number(),
    height: v.number(),
  }),
  content: v.any(),
  metadata: v.object({
    createdBy: v.string(),
    createdAt: v.number(),
    lastModified: v.number(),
    relationships: v.array(v.string()),
  }),
};

export const getElements = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("elements")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return rows.map((row) => ({
      id: row.elementId,
      type: row.type,
      position: row.position,
      size: row.size,
      content: row.content,
      metadata: row.metadata,
    }));
  },
});

export const createOrUpdateElement = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    element: v.object(elementValidator),
  },
  handler: async (ctx, args) => {
    await ensureRoomMember(ctx, args.roomId, args.sessionToken);

    const existing = await ctx.db
      .query("elements")
      .withIndex("by_room_element", (q) =>
        q.eq("roomId", args.roomId).eq("elementId", args.element.id),
      )
      .unique();

    const normalized = {
      roomId: args.roomId,
      elementId: args.element.id,
      type: args.element.type,
      position: args.element.position,
      size: args.element.size,
      content: args.element.content,
      metadata: {
        ...args.element.metadata,
        lastModified: Date.now(),
      },
    };

    if (!existing) {
      await ctx.db.insert("elements", normalized);
      return;
    }

    await ctx.db.patch(existing._id, normalized);
  },
});

export const moveElement = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    elementId: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ensureRoomMember(ctx, args.roomId, args.sessionToken);
    const row = await ctx.db
      .query("elements")
      .withIndex("by_room_element", (q) =>
        q.eq("roomId", args.roomId).eq("elementId", args.elementId),
      )
      .unique();

    if (!row) return;

    await ctx.db.patch(row._id, {
      position: args.position,
      metadata: {
        ...row.metadata,
        lastModified: Date.now(),
      },
    });
  },
});

export const deleteElement = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    elementId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureRoomMember(ctx, args.roomId, args.sessionToken);
    const row = await ctx.db
      .query("elements")
      .withIndex("by_room_element", (q) =>
        q.eq("roomId", args.roomId).eq("elementId", args.elementId),
      )
      .unique();

    if (row) {
      await ctx.db.delete(row._id);
    }

    const allRows = await ctx.db
      .query("elements")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    const connectors = allRows.filter(
      (item) =>
        item.type === "arrow" &&
        (item.content?.fromId === args.elementId ||
          item.content?.toId === args.elementId),
    );

    for (const connector of connectors) {
      await ctx.db.delete(connector._id);
    }
  },
});

export const connectElements = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    connectorId: v.string(),
    fromId: v.string(),
    toId: v.string(),
    anchorPoints: v.any(),
  },
  handler: async (ctx, args) => {
    await ensureRoomMember(ctx, args.roomId, args.sessionToken);
    const now = Date.now();
    const connector = {
      id: args.connectorId,
      type: "arrow",
      position: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
      content: {
        fromId: args.fromId,
        toId: args.toId,
        anchorPoints: args.anchorPoints,
      },
      metadata: {
        createdBy: args.sessionToken,
        createdAt: now,
        lastModified: now,
        relationships: [args.fromId, args.toId],
      },
    };

    const existing = await ctx.db
      .query("elements")
      .withIndex("by_room_element", (q) =>
        q.eq("roomId", args.roomId).eq("elementId", args.connectorId),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("elements", {
        roomId: args.roomId,
        elementId: connector.id,
        type: connector.type,
        position: connector.position,
        size: connector.size,
        content: connector.content,
        metadata: connector.metadata,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      content: connector.content,
      metadata: {
        ...existing.metadata,
        relationships: [args.fromId, args.toId],
        lastModified: now,
      },
    });
  },
});

export const updateTableCell = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    elementId: v.string(),
    rowIndex: v.number(),
    columnIndex: v.number(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureRoomMember(ctx, args.roomId, args.sessionToken);
    const row = await ctx.db
      .query("elements")
      .withIndex("by_room_element", (q) =>
        q.eq("roomId", args.roomId).eq("elementId", args.elementId),
      )
      .unique();

    if (!row || row.type !== "table") return;

    const current = row.content ?? {};
    const data: string[][] = Array.isArray(current.data)
      ? current.data.map((r: unknown) => (Array.isArray(r) ? [...(r as string[])] : []))
      : [];

    while (data.length <= args.rowIndex) data.push([]);
    while (data[args.rowIndex].length <= args.columnIndex) {
      data[args.rowIndex].push("");
    }

    data[args.rowIndex][args.columnIndex] = args.value;

    await ctx.db.patch(row._id, {
      content: {
        ...current,
        data,
        rows: Math.max(current.rows ?? 0, data.length),
        columns: Math.max(
          current.columns ?? 0,
          data.reduce((max, r) => Math.max(max, r.length), 0),
        ),
      },
      metadata: {
        ...row.metadata,
        lastModified: Date.now(),
      },
    });
  },
});
