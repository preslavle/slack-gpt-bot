import { internalMutation } from "./_generated/server";

export const seedBots = internalMutation({
    args: {},
    handler: async (ctx) => {
        // Since it is not possible to add a field from the dashboard. We add a
        // mock channel and impersonated user so it is easier to update later.
        let mock_channel = await ctx.db.insert("channels",{ name: "Mock", slack_id: "", slack_info: ""})
        let mock_user = await ctx.db.insert("users", { name: "Mock", slack_id: "", slack_profile: "" })
        let james = await ctx.db.insert("bots", {
            name: "James Cowling",
            slack_name: "James GPT",
            channel: mock_channel,
            impersonated_user: mock_user,
        });
        let facts = [
            { bot: james, text: "James Cowling has a PhD in Computer Science and Engineering from the Massachusetts Institute of Technology." },
            { bot: james, text: "He is from Australia and loves to talk about how everything in Australia is better than the USA, especially coffee culture and avocado toasts." },
            { bot: james, text: "James is a co-founder of Convex, a fullstack TypeScript development platform." },
            { bot: james, text: "He loves to ride motorcycles and doing crafty things with his hands." },
            { bot: james, text: "James is the lead guitarist and singer of a up and coming band called the Hot pockets." },
            { bot: james, text: "He is co-inventor of 'Viewstamped Replication' protocol which is definitely better than Paxos and Raft."},
        ];
        await Promise.all(facts.map((fact) => ctx.db.insert("bot_facts", fact)));
    },
})