import { v } from "convex/values";
import { ActionCtx, internalAction, internalQuery } from "./_generated/server";
import { postMessage } from "./slack";
import { internal } from "./_generated/api";
import { LLMMessage, chatCompletion, fetchEmbedding } from "./openai";
import { Doc, Id } from "./_generated/dataModel";

export const getForChannel = internalQuery({
    args: { channel_id: v.id("channels") },
    handler: async (ctx, { channel_id }) : Promise<Doc<"bots">[]> => {
        return await ctx.db
            .query("bots")
            .withIndex("by_channel", (q) => q.eq("channel", channel_id))
            .collect();
    }
});

export const getBotFacts = internalQuery({
    args: { bot_id: v.id("bots") },
    handler: async (ctx, { bot_id }) : Promise<Doc<"bot_facts">[]> => {
        return await ctx.db
            .query("bot_facts")
            .withIndex("by_bot", (q) => q.eq("bot", bot_id))
            .collect();
    }
});

const relevantHistoricMessages = async (
    ctx: ActionCtx,
    user: Id<"users">,
    prompt: Doc<"messages">,
) => {
    let result = await fetchEmbedding(prompt.body);
    const results = await ctx.vectorSearch("messages", "by_embedding", {
        vector: result.embedding,
        limit: 5,
        filter: (q) => q.eq("user", user),
    });
    let ids = results.map((r) => r._id);
    return await ctx.runQuery(internal.messages.getBodyBatch, { ids });
}

const prefixPrompt = async (
    ctx: ActionCtx,
    profile: Doc<"bots">,
    historicMessages: string[],
): Promise<LLMMessage> => {
    let content = `Your name is ${profile.name}. You are responding to users on chat app called Slack.\n`;

    let facts = await ctx.runQuery(internal.bots.getBotFacts, { bot_id: profile._id });
    if (facts.length > 0) {
        content += `Here are some facts you: ${facts.map((f) => f.text)}`;
    }

    if (historicMessages.length > 0) {
        console.log("historicMessages", historicMessages)
        content += `Here are relevant messages you have said in the past. Try to mimic those in your response ${historicMessages}.`;
    }
    
    content +=
         'Below are the current chat thread in the channel. Respond only to the last message and keep it brief within 500 characters: \n';

    // content +=
    //     'Below are the current chat thread in the channel. DO NOT greet the other people more than once. Only greet ONCE. Do not use the word Hey too often. Respond only to the last message and keep it brief within 500 characters: \n';

    return {
        content,
        role: 'user',
    }
}

export const respond = internalAction({
    args: { channel_id: v.id("channels") },
    handler: async (ctx, { channel_id }) => {
        let channel = await ctx.runQuery(internal.channels.getById, { channel_id });
        let messages = await ctx.runQuery(
            internal.messages.getLatest,
            { channel_id, count: 10 },
        );
        // The messages are in reverse order. Fix it so the bot responds to the
        // last one.
        messages.reverse();

        // Only respond if a bot is configured for this channel.
        let bots = await ctx.runQuery(internal.bots.getForChannel, { channel_id });
        for (let bot of bots) {
            // Fetch relevant historic messages.
            let historicMessages : string[] = [];
            if (bot.impersonated_user) {
                historicMessages = await relevantHistoricMessages(
                    ctx, bot.impersonated_user, messages[messages.length-1],
                );
            }

            let prompt = await prefixPrompt(ctx, bot, historicMessages);
            let chatMessages : LLMMessage[] = messages.map((m) => {
                return {
                    content: m.body,
                    role: 'user',
                }
            });
            console.log("Prefix prompt", prompt, chatMessages);

            let response = await chatCompletion({
                messages: [
                    prompt,
                    ...chatMessages,
                ]
            });
            console.log(`OpenAI request took ${response.ms} and ${response.retries} retries`);
            let responseContent = await response.content.readAll();
            await postMessage(ctx, bot.slack_name, channel?.slack_info.id, responseContent);
        }
    },
});
