### Slack App Configuration
1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable Interactivity & Shortcuts:
   - Set the request URL to either:
     - `https://your-domain.com/api/slack-interactions` (preferred)
     - `https://your-domain.com/api/slack-interaction` (also works as a redirect)
   - For local testing, use [ngrok](https://ngrok.com): `ngrok http 3000`
3. Add the following Bot Token Scopes:
   - `chat:write`
   - `chat:write.public`
   - `chat:write.customize`
   - `channels:read`
   - `groups:read`
   - `users:read` (optional, for showing real names in responses)
   - `users:read.email` (optional, for showing real names in responses)
   - `commands`
4. Install the app to your workspace
5. Invite the bot to your channel (e.g., #english-club)
6. Copy the Bot User OAuth Token and Signing Secret to your `.env.local` file


### Slack App Manifest

Here's a sample manifest you can use in the Slack API dashboard:

```yaml
display_information:
  name: Quiz App
  description: Posts AI news, tools, and prompts with interactive quizzes
  background_color: "#2c2d30"
features:
  bot_user:
    display_name: Quiz Bot
    always_online: true
  slash_commands:
    - command: /quiz
      description: Show recent quizzes
      usage_hint: "/quiz [topic]"
      should_escape: false
oauth_config:
  scopes:
    bot:
      - chat:write
      - chat:write.public
      - chat:write.customize
      - commands
settings:
  interactivity:
    is_enabled: true
    request_url: https://your-domain.com/api/slack-interactions
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

### Running the App
Development:
```
npm run dev
```

Production:
```
npm run build
npm start
```

