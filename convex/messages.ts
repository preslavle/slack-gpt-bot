import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchEmbedding } from "./openai";

export const insert = internalMutation({
    args: {
        body: v.string(),
        user_id: v.id("users"),
        channel_id: v.id("channels"),
        slack_client_msg_id: v.optional(v.string()),
    },
    handler: async (ctx, { body, slack_client_msg_id, user_id, channel_id }) => {
        // Don't record the message if there is an active bot in the channel
        // because it pollutes the conversation too much.
        let bot_for_channel = await ctx.db
            .query("bots")
            .withIndex("by_channel", (q) => q.eq("channel", channel_id))
            .first();
        if (bot_for_channel !== null) {
            return;
        }

        // Insert the message.
        let id = await ctx.db.insert("messages", {
            body,
            user: user_id,
            channel: channel_id,
            slack_client_msg_id: slack_client_msg_id
        });

        // Generate embedding if there is any bot impersonating that user.
        let bot_for_user = await ctx.db
            .query("bots")
            .withIndex("by_impersonated_user", (q) => q.eq("impersonated_user", user_id))
            .first();
        if (bot_for_user !== null) {
            await ctx.scheduler.runAfter(0, internal.messages.generateEmbedding, { message_id: id });
        }
    }
});

export const getLatest = internalQuery({
    args: { channel_id: v.id("channels"), count: v.optional(v.number()) },
    handler: async (ctx, { channel_id, count }) => {
        if (!count) {
            count = 10;
        }
        return await ctx.db.query("messages")
            .withIndex("by_channel", (q) => q.eq("channel", channel_id))
            .order("desc")
            .take(count);
    }
});

export const get = internalQuery({
    args: { id: v.id("messages") },
    handler: async (ctx, { id }) => {
        return await ctx.db.get(id);
    }
});

export const getBodyBatch = internalQuery({
    args: { ids: v.array(v.id("messages")) },
    handler: async (ctx, { ids }) => {
        let messages = [];
        for (let message of await Promise.all(ids.map((id) => ctx.db.get(id)))) {
            if (message !== null) {
                messages.push(message.body);
            }
        }
        return messages;
    }
});

export const addEmbedding = internalMutation({
    args: { id: v.id("messages"), embedding: v.array(v.float64()) },
    handler: async (ctx, { id, embedding }) => {
        return await ctx.db.patch(id, { embedding: embedding });
    }
});

export const generateEmbedding = internalAction({
    args: { message_id: v.id("messages") },
    handler: async (ctx, { message_id }) => {
        let message = await ctx.runQuery(internal.messages.get, { id: message_id });
        if (message !== null) {
            console.log(`Generating embeddings for ${message.body}`);
            let result = await fetchEmbedding(message.body);
            await ctx.runMutation(internal.messages.addEmbedding, {
                id: message_id,
                embedding: result.embedding,
            });
        }
    }
});
