import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertRateLimit, hashPasscode } from "./lib/security";
import type { MutationCtx } from "./_generated/server";

function randomSixDigitCode(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function getUniqueCode(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const candidate = randomSixDigitCode();
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", candidate))
      .unique();
    if (!existing) return candidate;
  }
  throw new Error("Could not allocate a room code. Try again.");
}

export const getRoomByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!room) {
      return null;
    }

    return {
      _id: room._id,
      code: room.code,
      createdAt: room.createdAt,
    };
  },
});

export const createRoom = mutation({
  args: {
    passcode: v.string(),
    sessionName: v.optional(v.string()),
    clientKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^\d{6}$/.test(args.passcode)) {
      throw new Error("Passcode must be exactly 6 digits.");
    }
    await assertRateLimit(ctx, `create:${args.clientKey}`);

    const code = await getUniqueCode(ctx);
    const passcodeHash = await hashPasscode(args.passcode);
    const now = Date.now();
    const sessionToken = crypto.randomUUID();
    const roomId = await ctx.db.insert("rooms", {
      code,
      passcodeHash,
      createdAt: now,
      createdBySession: sessionToken,
    });

    await ctx.db.insert("roomMembers", {
      roomId,
      sessionToken,
      sessionName: args.sessionName?.trim() || "Host",
      joinedAt: now,
      lastSeen: now,
    });

    return {
      roomId,
      code,
      sessionToken,
    };
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    passcode: v.string(),
    sessionName: v.optional(v.string()),
    clientKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^\d{6}$/.test(args.passcode)) {
      throw new Error("Passcode must be exactly 6 digits.");
    }
    await assertRateLimit(ctx, `join:${args.clientKey}:${args.code}`);

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!room) {
      throw new Error("Room not found.");
    }

    const passcodeHash = await hashPasscode(args.passcode);
    if (room.passcodeHash !== passcodeHash) {
      throw new Error("Invalid passcode.");
    }

    const now = Date.now();
    const sessionToken = crypto.randomUUID();
    await ctx.db.insert("roomMembers", {
      roomId: room._id,
      sessionToken,
      sessionName: args.sessionName?.trim() || "Guest",
      joinedAt: now,
      lastSeen: now,
    });

    return {
      roomId: room._id,
      code: room.code,
      sessionToken,
    };
  },
});

export const validateSession = query({
  args: {
    code: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!room) return { valid: false, checkedToken: args.sessionToken };

    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", room._id).eq("sessionToken", args.sessionToken),
      )
      .unique();

    if (!member) return { valid: false, checkedToken: args.sessionToken };

    return {
      valid: true,
      checkedToken: args.sessionToken,
      roomId: room._id,
      code: room.code,
      sessionName: member.sessionName,
    };
  },
});

export const getActiveUserCount = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const activeCutoff = Date.now() - 20_000;
    const cursors = await ctx.db
      .query("presence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    const unique = new Set(
      cursors
        .filter((cursor) => cursor.lastSeen >= activeCutoff)
        .map((cursor) => cursor.sessionToken),
    );
    return unique.size;
  },
});
