# Slack Quiz App

A Next.js application that generates quizzes from content and posts them to Slack.

## Setup

### Installation
```
npm install @slack/web-api --save
```

### Environment Setup
Create a `.env.local` file with:
```
OPENAI_API_KEY=your-openai-api-key
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
PORT=3002
REDIS_URL=redis://localhost:6379  # Optional, for Redis
```

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

### Handling Quiz Responses

The app is now configured to:
- Show a "Post to Slack" button for each individual item
- Make quiz responses visible only to the user who answered (ephemeral messages)
- Save all quiz content to JSON files

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

## Features
- Generates multi-question quizzes with OpenAI
- Creates key vocabulary from provided content
- Posts interactive quizzes to Slack
- Shows correct/incorrect answers with feedback
- Records user responses
- Dark mode support with system preference detection and manual toggle

## Data Structure
The application uses the following data structures:

### Quizzes
Quizzes are stored as individual JSON files in the `data/quizzes/` directory with filenames that include timestamps and Slack message IDs. Each file has the following structure:
```json
{
  "date": "2025-05-17T09:35:35.783Z",
  "slackMessageId": "1747474535.653199", 
  "quiz": [
    {
      "question": "What is the primary function of OpenAI's Codex?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct": "Option 2"
    }
  ],
  "vocabulary": [
    {
      "term": "Codex",
      "definition": "An AI tool developed by OpenAI"
    }
  ]
}
```

### Responses
User responses are stored in `data/responses.json` with the following structure:
```json
[
  {
    "userId": "U07KDMP5NBZ",
    "quizId": "1747474535.653199",
    "questionIndex": 0,
    "question": "What is the primary function of OpenAI's Codex?",
    "answer": "To assist with coding, debugging, and testing software",
    "isCorrect": true,
    "timestamp": "2025-05-17T09:36:06.892Z"
  }
]
```

The system uses consistent IDs:
- `slackMessageId`: The Slack message timestamp, used to identify quizzes
- `questionIndex`: The zero-based index of the question within the quiz 
- `quizId`: In responses, refers to the `slackMessageId` of the quiz

## Dark Mode
The application supports dark mode:
- Automatically detects system preference for light/dark mode
- Toggle button in the top right corner for manual switching
- Persistently remembers your preference