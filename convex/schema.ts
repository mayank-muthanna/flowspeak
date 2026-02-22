import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    passcodeHash: v.string(),
    createdAt: v.number(),
    createdBySession: v.string(),
  }).index("by_code", ["code"]),
  roomMembers: defineTable({
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    sessionName: v.string(),
    joinedAt: v.number(),
    lastSeen: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionToken"]),
  elements: defineTable({
    roomId: v.id("rooms"),
    elementId: v.string(),
    type: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    size: v.object({
      width: v.number(),
      height: v.number(),
    }),
    style: v.optional(
      v.object({
        color: v.string(),
        opacity: v.number(),
      }),
    ),
    content: v.any(),
    metadata: v.object({
      createdBy: v.string(),
      createdAt: v.number(),
      lastModified: v.number(),
      relationships: v.array(v.string()),
    }),
  })
    .index("by_room", ["roomId"])
    .index("by_room_element", ["roomId", "elementId"]),
  presence: defineTable({
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    x: v.number(),
    y: v.number(),
    lastSeen: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionToken"]),
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
});
