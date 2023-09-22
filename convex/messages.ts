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
        // Insert the message.
        let id = await ctx.db.insert("messages", {
            body,
            user: user_id,
            channel: channel_id,
            slack_client_msg_id: slack_client_msg_id
        });

        // Generate embedding if there is any bot impersonating that user,
        // but not if the message is coming from a conversation with a bot since
        // the latter pollutes the information too much.
        let bot_for_user = await ctx.db
            .query("bots")
            .withIndex("by_impersonated_user", (q) => q.eq("impersonated_user", user_id))
            .first();
        let bot_for_channel = await ctx.db
            .query("bots")
            .withIndex("by_channel", (q) => q.eq("channel", channel_id))
            .first();
        if (bot_for_channel === null && bot_for_user !== null) {
            await ctx.scheduler.runAfter(0, internal.messages.generateEmbedding, { message_id: id });
        }
    }
});

export const getLastConversation = internalQuery({
    args: { channel_id: v.id("channels") },
    handler: async (ctx, { channel_id }) => {
        let messages = await ctx.db.query("messages")
            .withIndex("by_channel", (q) => q.eq("channel", channel_id))
            .order("desc")
            .take(5);
        let recent_messages = messages.filter((m) => messages[0]._creationTime - m._creationTime < 60);
        recent_messages.reverse();
        return recent_messages;
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
    handler: async (ctx, { ids }): Promise<{body: string, author: string}[]> => {
        let messages = await Promise.all(ids.map((id) => ctx.db.get(id)));
        let users = await Promise.all(messages.map((message) => ctx.db.get(message!.user)));
        return messages.map((message, i) => {
            return { body: message!.body, author: users[i]!.name };
        });
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
