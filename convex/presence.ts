import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ensureRoomMember } from "./lib/security";

export const heartbeat = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const member = await ensureRoomMember(ctx, args.roomId, args.sessionToken);
    const now = Date.now();

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionToken", args.sessionToken),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("presence", {
        roomId: args.roomId,
        sessionToken: args.sessionToken,
        x: args.x,
        y: args.y,
        lastSeen: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        x: args.x,
        y: args.y,
        lastSeen: now,
      });
    }

    await ctx.db.patch(member._id, {
      lastSeen: now,
    });
  },
});

export const getPresence = query({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 15_000;
    const cursors = await ctx.db
      .query("presence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return cursors
      .filter((cursor) => cursor.lastSeen >= cutoff)
      .filter((cursor) => cursor.sessionToken !== args.sessionToken);
  },
});
