import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const getById = internalQuery({
    args: { channel_id: v.id("channels") },
    handler: async (ctx, { channel_id }) : Promise<Doc<"channels"> | null> => {
        return await ctx.db.get(channel_id);
    }
});

export const getBySlackId = internalQuery({
    args: { slack_id: v.string() },
    handler: async (ctx, { slack_id }) : Promise<Doc<"channels"> | null> => {
        return await ctx.db
            .query("channels")
            .withIndex("by_slack_id", (q) => q.eq("slack_id", slack_id))
            .first();
    }
});

export const insert = internalMutation({
    args: { slack_id: v.string(), slack_info: v.any() },
    handler: async (ctx, { slack_id, slack_info }) : Promise<Doc<"channels">> => {
        // This is gross. I add it so I don't insert the same thing twice.
        // Something like on-duplicate-ignore would be nice.
        let channel = await ctx.db
            .query("channels")
            .withIndex("by_slack_id", (q) => q.eq("slack_id", slack_id))
            .first();
        if (channel !== null) {
            return channel;
        }
        let channel_id = await ctx.db.insert("channels", {
            name: slack_info.name_normalized,
            slack_id: slack_id,
            slack_info: slack_info,
        });
        return (await ctx.db.get(channel_id))!;
    }
});
