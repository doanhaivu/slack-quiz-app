# Slack Audio Reply Setup Guide

This guide explains how to set up your Slack app to handle audio replies to news pieces with pronunciation feedback.

## What's Been Implemented

1. **Event Handler API** (`/pages/api/slack/events.ts`)
   - Listens for Slack message events with audio file attachments
   - Processes audio files in thread replies to news pieces
   - Uses OpenAI Whisper for speech-to-text conversion
   - Uses GPT-4 to compare pronunciation and provide feedback
   - Posts feedback back to the Slack thread

## Slack App Configuration Required

### 1. Enable Event Subscriptions

In your Slack app configuration (https://api.slack.com/apps):

1. Go to **Event Subscriptions**
2. Turn on **Enable Events**
3. Set the **Request URL** to: `https://your-domain.com/api/slack/events`
4. Under **Subscribe to bot events**, add these scopes:
   - `message.channels` - Listen for messages in channels
   - `file_shared` - Listen for file uploads

### 2. Required OAuth Scopes

Make sure your bot has these scopes in **OAuth & Permissions**:
- `channels:history` - **CRITICAL**: Read messages in channels (needed to detect thread replies)
- `chat:write` - Post messages
- `files:read` - Access uploaded files
- `users:read` - Read user information

**⚠️ Important**: The `channels:history` scope is essential for the audio processing to work. Without it, the bot cannot determine if an audio file was posted as a reply to a thread.

### 3. Environment Variables

Ensure these are set in your `.env.local`:
```
SLACK_BOT_TOKEN=xoxb-your-bot-token
OPENAI_API_KEY=your-openai-api-key
```

## How It Works

1. **User Flow:**
   - User sees a news piece posted by the bot
   - User records an audio message and posts it as a reply in the thread
   - Bot automatically detects the audio file in the thread reply

2. **Processing:**
   - Bot downloads the audio file from Slack
   - Converts audio to text using OpenAI Whisper
   - Extracts original news text from the parent message
   - Uses GPT-4 to compare pronunciation and generate feedback
   - Posts formatted feedback in the same thread

3. **Feedback Format:**
   ```
   🎤 Pronunciation Feedback for @username

   📝 What you said:
   "User's transcribed speech"

   📊 Feedback:
   [GPT-4 generated feedback with score and suggestions]
   ```

## Supported Audio Formats

- MP3 (.mp3)
- WAV (.wav)
- M4A (.m4a)
- Any file with MIME type starting with 'audio/'

## Testing

1. Post a news piece to your Slack channel
2. Reply to that message with an audio recording
3. The bot should automatically process the audio and provide feedback

## Troubleshooting

### Missing Scope Error
If you see `missing_scope` errors in the logs:
1. Go to your Slack app settings (https://api.slack.com/apps)
2. Navigate to **OAuth & Permissions**
3. Add the `channels:history` scope
4. **Reinstall the app** to your workspace (click "Install to Workspace")
5. The bot will post an error message in the channel if this scope is missing

### Other Issues
- Check the server logs for any errors during processing
- Ensure the Slack app has the correct permissions
- Verify that the OpenAI API key is valid and has credits
- Make sure the event URL is accessible from Slack's servers
- Ensure you're replying to a thread, not posting a new message 