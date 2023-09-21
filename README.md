## Setup
1. Obtain an OpenAI kei and store it in OPENAI_API_KEY.
2. Create a new app in Slack, and store its OAUTH token in SLACK_OAUTH_TOKEN. The app needs to have the following permissions: ["app_mentions:read", "channels:history", "channels:read", "chat:write", "chat:write.customize", "users.profile:read"]
3. Setup the Slack App Event Subscriptions to https://{deployment-name}.convex.site/slack/action-endpoint
4. Add the App to your app workspace and add the bot to few channels. You should see the channels, users and messages,
getting populated in the dashboard with each message send.

TODO: Make the following slack commands so they can be done without editing the dashboard.
5. Optionally, run `init:seedBots` from the dashboard to setup couple of bots.
6. Associate the bots with the channels they should respond to by setting their 'channel' field via the dashboard. Once this is setup, the bot should start responding in the respective channels.
7. Optionally, set the user the bot should impersonate by setting its 'impersonated_user' via field via the dashboard. Once this is setup, the app will start computing embeddings for each messages send by this user, and will use them to train the bot.
