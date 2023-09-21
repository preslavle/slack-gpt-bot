import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const getById = internalQuery({
    args: { user_id: v.id("users") },
    handler: async (ctx, { user_id }) : Promise<Doc<"users"> | null> => {
        return await ctx.db.get(user_id);
    }
});

export const getBySlackId = internalQuery({
    args: { slack_id: v.string() },
    handler: async (ctx, { slack_id }) : Promise<Doc<"users"> | null> => {
        return await ctx.db
            .query("users")
            .withIndex("by_slack_id", (q) => q.eq("slack_id", slack_id))
            .first();
    }
});

export const insert = internalMutation({
    args: { slack_id: v.string(), slack_profile: v.any() },
    handler: async (ctx, { slack_id, slack_profile }) : Promise<Doc<"users">> => {
        // This is gross. I add it so I don't insert the same thing twice.
        // Something like on-duplicate-ignore would be nice.
        let user = await ctx.db
            .query("users")
            .withIndex("by_slack_id", (q) => q.eq("slack_id", slack_id))
            .first();
        if (user !== null) {
            return user;
        }
        let channel_id = await ctx.db.insert("users", {
            name: slack_profile.real_name_normalized,
            slack_id: slack_id,
            slack_profile: slack_profile,
            identity: "",
        });
        return (await ctx.db.get(channel_id))!;
    }
});
