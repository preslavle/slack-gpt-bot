import { ActionCtx, QueryCtx, httpAction, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc } from './_generated/dataModel';

const SLACK_OAUTH_TOKEN = process.env.SLACK_OAUTH_TOKEN;

export const eventCallback = httpAction(async (ctx, request) => {
    const parsed_request = await request.json();
    if (parsed_request.type == "url_verification") {
        return new Response(parsed_request.challenge)
    } else if (parsed_request.type == "event_callback") {
        await ctx.scheduler.runAfter(0, internal.slack.processEvent, { event: parsed_request.event });
    } else {
        console.log(parsed_request);
    }
    return new Response("Success");
});

export const processEvent = internalAction({
    args: { event: v.any() },
    handler: async (ctx, { event }) => {
        if (event.app_id) {
            // Don't process messages from apps. At minimum we should not react
            // on messages from ourselves.
            return;
        }
        if (event.type == "message") {
            if (!event.user || !event.channel || !event.client_msg_id) {
                console.log("Unsupported message", event);
                return;
            }
            let user = await getUserProfile(ctx, event.user);
            let channel = await getChannelInfo(ctx, event.channel);
            let client_msg_id = event.client_msg_id;
            await ctx.runMutation(internal.messages.insert, {
                user_id: user._id,
                channel_id: channel._id,
                slack_client_msg_id: client_msg_id,
                body: event.text,
            });
            // Respond to the message.
            await ctx.scheduler.runAfter(0, internal.bots.respond, { channel_id: channel._id });
        }
    },
});

const getUserProfile = async (ctx : ActionCtx, slack_id: string): Promise<Doc<"users">> => {
    let user = await ctx.runQuery(internal.users.getBySlackId, { slack_id });
    if (user === null) {
        // Fetch from Slack.
        console.log(`Fetching user ${slack_id} info from Slack.`)
        let params = new URLSearchParams({"user": slack_id});
        let response = await fetch(`https://slack.com/api/users.profile.get?${params}`, {
            method: "GET",
            headers: {
                authorization: `Bearer ${SLACK_OAUTH_TOKEN}`,
            },
        });
        let body = await response.json();
        if (!body.ok) {
            console.log(body);
            throw new Error(`slack/users.profile.get failed.`);
        }
        // Insert in the db.
        user = await ctx.runMutation(internal.users.insert, {
            slack_id: slack_id,
            slack_profile: body.profile,
        })
    }
    return user;
};

const getChannelInfo = async (ctx : ActionCtx, slack_id: string) => {
    let channel = await ctx.runQuery(internal.channels.getBySlackId, { slack_id });
    if (channel === null) {
        // Fetch from Slack.
        console.log(`Fetching channel ${slack_id} info from Slack.`)
        let params = new URLSearchParams({"channel": slack_id});
        let response = await fetch(`https://slack.com/api/conversations.info?${params}`, {
            method: "GET",
            headers: {
                authorization: `Bearer ${SLACK_OAUTH_TOKEN}`,
            },
        });
        let body = await response.json();
        if (!body.ok) {
            console.log(body);
            throw new Error(`slack/conversations.info failed.`);
        }
        // Insert in the db.
        channel = await ctx.runMutation(internal.channels.insert, {
            slack_id: slack_id,
            slack_info: body.channel,
        })
    }
    return channel;
};

export const postMessage = async(ctx : ActionCtx, author: string, channel: string, message: string) => {
    let response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${SLACK_OAUTH_TOKEN}`,
        },
        body: JSON.stringify({
            channel,
            text: message,
            username: author,
        }),
    });
    let body = await response.json();
    if (!body.ok) {
        console.log(body);
        throw new Error(`slack.com/chat.postMessage failed.`);
    }
};
