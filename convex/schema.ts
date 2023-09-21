import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    slack_id: v.string(),
    slack_profile: v.any(),
    identity: v.optional(v.string()),
  }).index("by_slack_id", ["slack_id"]),

  channels: defineTable({
    name: v.string(),
    slack_id: v.string(),
    slack_info: v.any(),
  }).index("by_slack_id", ["slack_id"]),

  messages: defineTable({
    user: v.id("users"),
    channel: v.id("channels"),
    body: v.string(),
    embedding: v.optional(v.array(v.float64())),
  })
  .index("by_channel", ["channel"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["user"],
  }),

  bots: defineTable({
    channel: v.optional(v.id("channels")),
    name: v.string(),
    impersonated_user: v.optional(v.id("users")),
  })
  .index("by_channel", ["channel"])
  .index("by_impersonated_user", ["impersonated_user"]),

  bot_facts: defineTable({
    bot: v.id("bots"),
    text: v.string(),
    embedding: v.optional(v.array(v.float64())),
  })
  .index("by_bot", ["bot"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["bot"],
  }),

});
