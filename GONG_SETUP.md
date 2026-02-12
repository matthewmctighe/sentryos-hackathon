# Gong API Integration Setup

This guide will help you set up the Gong API integration for the Transcript Analyzer.

## Prerequisites

- A Gong account with API access
- A Gong API key (Bearer token)

## Getting Your Gong API Key

1. Log in to your Gong account
2. Navigate to **Settings** → **API** → **Documentation**
3. Generate or copy your API key (it will look like a long string of characters)

## Configuration

1. Create a `.env.local` file in the root of your project:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your Gong API key:

```env
GONG_API_KEY=your_actual_gong_api_key_here
GONG_API_BASE_URL=https://api.gong.io/v2
```

3. Restart your development server:

```bash
npm run dev
```

## API Endpoints Created

### 1. `/api/gong/users` (GET)
- Fetches all active Gong users
- Returns: `{ users: [{ id, name, email }] }`

### 2. `/api/gong/calls` (GET)
- Fetches calls for a specific user from the last 30 days
- Query params: `userId` (required), `limit` (optional, default: 10)
- Returns: `{ calls: [{ id, title, date, duration, url, parties }], total }`

### 3. `/api/gong/transcript` (GET)
- Fetches the full transcript for a specific call
- Query params: `callId` (required)
- Returns: `{ callId, transcript, rawTranscript, callDetails }`

## How It Works

1. **User Selection**: The TranscriptAnalyzer component loads all active Gong users on mount
2. **Call Filtering**: When a user is selected, it fetches their most recent calls (last 30 days)
3. **Transcript Loading**: When a call is selected, it fetches the full transcript with timestamps and speaker identification
4. **AI Analysis**: The transcript can then be analyzed using the existing `/api/analyze-transcript` endpoint

## Integration with Sentry Skills

Once transcripts are loaded, you can use Sentry skills to:
- Identify mentions of error handling, monitoring, and observability
- Provide best practices based on the conversation context
- Suggest relevant Sentry documentation
- Offer implementation guidance for Sentry features discussed in calls

## Rate Limits

Gong API has the following default limits:
- 3 requests per second
- 10,000 requests per day

The integration is designed to be efficient and stay within these limits.

## Troubleshooting

### "Failed to load Gong users"
- Check that your `GONG_API_KEY` is correctly set in `.env.local`
- Verify your API key has the required permissions (`api:calls:read:basic`)
- Check that your development server has been restarted after adding the env variable

### "Failed to load calls"
- Ensure the selected user has recorded calls in the last 30 days
- Check your API rate limits haven't been exceeded

### "Failed to load transcript"
- Verify the call has been processed and has an available transcript
- Some calls may take time to be transcribed after they occur

## API Permissions Required

Your Gong API key needs the following scopes:
- `api:calls:read:basic` - To list and retrieve calls
- `api:users:read` - To list users
- `api:calls:read:extensive` - To get transcripts and detailed call data
