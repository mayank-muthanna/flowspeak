import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPasscode(passcode: string): Promise<string> {
  const normalized = passcode.trim();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return bytesToHex(hashBuffer);
}

export async function assertRateLimit(
  ctx: MutationCtx,
  key: string,
): Promise<void> {
  const now = Date.now();
  const rateLimitDoc = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!rateLimitDoc) {
    await ctx.db.insert("rateLimits", {
      key,
      windowStart: now,
      count: 1,
    });
    return;
  }

  if (now - rateLimitDoc.windowStart > RATE_LIMIT_WINDOW_MS) {
    await ctx.db.patch(rateLimitDoc._id, {
      windowStart: now,
      count: 1,
    });
    return;
  }

  if (rateLimitDoc.count >= RATE_LIMIT_MAX) {
    throw new Error("Too many attempts. Please wait a minute.");
  }

  await ctx.db.patch(rateLimitDoc._id, { count: rateLimitDoc.count + 1 });
}

export async function ensureRoomMember(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  sessionToken: string,
): Promise<Doc<"roomMembers">> {
  const member = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_session", (q) =>
      q.eq("roomId", roomId).eq("sessionToken", sessionToken),
    )
    .unique();

  if (!member) {
    throw new Error("Invalid room session.");
  }

  return member;
}
