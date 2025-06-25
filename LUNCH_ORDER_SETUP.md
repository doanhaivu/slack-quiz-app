# 🍽️ Slack Lunch Order System

A simple and effective lunch ordering system that integrates with your existing Slack bot to help teams coordinate daily lunch orders.

## 🌟 Features

- **Daily Automated Messages**: Schedule lunch order messages at configurable times
- **Simple Reaction-Based Ordering**: Users react with ✅ to order or ❌ to decline
- **Real-Time Updates**: Message updates automatically showing who ordered
- **Comprehensive Tracking**: See who ordered, who didn't, and ordering statistics
- **Smart Reminders**: Send gentle or urgent reminders to non-respondents
- **Admin Dashboard**: Easy-to-use web interface for managing orders
- **Weekend Skip**: Automatically skips posting on weekends

## 🚀 How It Works

### For Users (Simple!)
1. **See the Message**: Bot posts daily lunch order message at configured time (e.g., 9:30 AM)
2. **React to Respond**: React with ✅ to order lunch or ❌ if you're not ordering
3. **Live Updates**: Message updates in real-time showing all orders
4. **Priority Logic**: If you react with both, ❌ takes priority (you won't be counted as ordering)

### For Admins (Powerful!)
1. **Automated Posting**: Set up cron jobs for automatic daily messages
2. **Track Orders**: View comprehensive statistics and who hasn't ordered
3. **Send Reminders**: Gentle nudges or urgent reminders for stragglers
4. **Manual Control**: Post messages manually when needed

## 🛠️ Setup Instructions

### 1. Slack App Configuration

In your Slack app settings (https://api.slack.com/apps), ensure you have:

**Event Subscriptions:**
- Enable Events: ON
- Request URL: `https://your-domain.com/api/slack/events`
- Bot Events:
  - `reaction_added` - Track when users react
  - `reaction_removed` - Track when users remove reactions

**OAuth Scopes:**
- `chat:write` - Post messages
- `chat:write.public` - Post to public channels
- `channels:read` - List available channels
- `channels:history` - Read channel messages
- `conversations:read` - Access channel information
- `reactions:read` - Read message reactions
- `reactions:write` - Add reactions to messages
- `users:read` - Get user information

### 2. Environment Variables

Add to your `.env.local`:
```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token  # Used for default bot configuration
SLACK_CHANNEL_ID=C1234567890  # Your lunch channel ID
CRON_SECRET_TOKEN=your-secure-random-token  # Optional, for cron security (deprecated)
```

**Note:** The system now uses bot configurations managed through the admin interface. Environment variables are only used as fallback for the "default" bot configuration.

### 3. API Endpoints Created

- `POST /api/lunch/schedule` - Post daily lunch message
- `GET /api/lunch/schedule` - Get today's orders
- `POST /api/lunch/cron` - Automated daily posting (for cron jobs)
- `GET /api/lunch/summary` - Get detailed order statistics
- `POST /api/lunch/summary` - Send reminder messages
- `POST /api/lunch/reaction-handler` - Handle pizza reactions (internal)

### 4. Admin Dashboard

Access the admin interface at: `https://your-domain.com/lunch-admin`

Features:
- View today's order statistics
- See who ordered and who didn't
- Post lunch messages manually
- Send reminder messages
- Real-time order tracking
- Channel selection dropdown
- Bot selection dropdown

### 5. Bot Configuration

Access bot management at: `https://your-domain.com/bot-admin`

Features:
- Add multiple bot configurations
- Manage bot tokens and signing secrets
- View bot status and configuration health
- Delete unused bot configurations (except default)

## 📅 Automation Setup

### Option 1: Vercel Cron Jobs (Recommended)

Add to your `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/lunch/cron",
      "schedule": "30 9 * * 1-5"
    }
  ]
}
```

### Option 2: External Cron Service

Use services like GitHub Actions or external cron:
```bash
curl -X POST "https://your-domain.com/api/lunch/cron" \
  -H "Authorization: Bearer your-cron-secret-token"
```

### Option 3: Manual Posting

Use the admin dashboard or call the API directly:
```bash
curl -X POST "https://your-domain.com/api/lunch/schedule" \
  -H "Content-Type: application/json" \
  -d '{"scheduledTime": "09:30"}'
```

## 🎯 Usage Examples

### Daily Workflow

1. **9:30 AM**: Bot posts lunch order message (manually via admin dashboard)
2. **9:30-10:30 AM**: Team members react with ✅ to order or ❌ to decline
3. **10:00 AM**: Admin checks dashboard, sends gentle reminder if needed
4. **10:20 AM**: Admin sends urgent reminder for non-respondents
5. **10:30 AM**: Order deadline, admin can see final summary

### Message Example

```
🍽️ Daily Lunch Order

📅 Monday, January 15, 2024

✅ React with :white_check_mark: to order lunch!
❌ React with :x: if you're not ordering

Orders so far (3):
• John Smith
• Sarah Wilson
• Mike Chen

⏰ Deadline: 10:30 AM | 📊 Total orders: 3
```

## 📊 Admin Dashboard Features

### Statistics View
- Total orders vs. total team members (per channel)
- Ordering rate percentage
- List of people who ordered (with timestamps)
- List of people who haven't ordered yet

### Quick Actions
- Post today's lunch message
- Refresh current statistics
- Send gentle reminder
- Send urgent reminder

### Real-Time Updates
- Dashboard updates automatically
- Shows live ordering statistics
- Tracks order timestamps

### Multi-Bot Support
- Select which bot to use from dropdown
- Each bot can target different channels/teams
- Separate member counting per channel
- Bot configuration management interface

## 🔧 Customization Options

### Message Timing
Modify the `scheduledTime` parameter:
```javascript
// 9:30 AM
{ "scheduledTime": "09:30" }

// 10:00 AM  
{ "scheduledTime": "10:00" }
```

### Reminder Messages
Two types available:
- **Gentle**: Friendly reminder that orders are still open
- **Urgent**: Last call with list of non-respondents

### Channel Targeting
Override default channel:
```javascript
{
  "channelId": "C9876543210",
  "scheduledTime": "09:30"
}
```

## 🎨 Benefits Over Traditional Polls

1. **Clearer Intent**: React with ✅ to order or ❌ to decline - no ambiguity
2. **Live Updates**: Message updates in real-time
3. **Better Tracking**: See exactly who ordered and when
4. **Smart Reminders**: Target only people who haven't responded
5. **Admin Control**: Full management interface
6. **No Poll Limits**: Slack polls have limitations, this doesn't
7. **Persistent**: Message stays updated throughout the day
8. **Priority Logic**: Cross reaction takes priority if someone reacts with both

## 🔒 Security Features

- Optional authentication for cron endpoints
- Input validation on all API calls
- Error handling with graceful fallbacks
- Bot token security through environment variables

## 🐛 Troubleshooting

### Common Issues

**Reactions not working?**
- Check if `reaction_added` and `reaction_removed` events are configured
- Verify bot has `reactions:read` scope

**Messages not posting?**
- Confirm `SLACK_BOT_TOKEN` is correct
- Check bot has `chat:write` permission in the channel
- Verify bot can add reactions (`reactions:write` scope)

**Admin dashboard not loading data?**
- Ensure lunch message was posted first
- Check browser console for API errors

### Debug Mode

Enable detailed logging by checking your deployment logs when calling endpoints.

## 📈 Future Enhancements

Potential additions:
- Database storage instead of in-memory
- Multiple restaurant/menu options
- Order history and analytics
- Integration with food delivery services
- Customizable reminder schedules
- Team preferences and dietary restrictions

## 🤝 Contributing

This lunch ordering system is designed to be:
- Easy to set up
- Simple to use
- Highly customizable
- Maintainable

Feel free to extend or modify based on your team's needs! 