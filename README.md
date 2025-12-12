# LifeLine – Emergency Voice Coach

A voice-first emergency coaching assistant built with Next.js and ElevenLabs Conversational AI.

## ⚠️ Important Safety Disclaimers

**LifeLine is NOT:**
- A doctor, paramedic, or medical professional
- A replacement for emergency medical services (EMS)
- A substitute for calling 911 or your local emergency number

**Always call your local emergency number (911 in the US) for immediate medical emergencies.**

This application is designed for educational and demonstration purposes only. Do not rely solely on this application during a real emergency.

## What It Does

LifeLine is a voice-first assistant that uses ElevenLabs' Conversational AI for speech-to-text, language model processing, and text-to-speech. It helps coach users through emergencies at a high level by:

- Listening to the user describe their situation via voice
- Providing step-by-step guidance and calming instructions
- Encouraging users to call emergency services when appropriate
- Optionally triggering calls to pre-configured emergency contacts
- Logging events to an n8n webhook for monitoring and automation

The assistant has been configured with safety guardrails in the ElevenLabs dashboard to ensure it always encourages professional medical help.

## Tech Stack & Integrations

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Voice AI:** ElevenLabs Conversational AI (Realtime WebSocket API)
- **Phone Calls:** Twilio (triggered via `/api/call-contact`)
- **Event Logging:** n8n webhook (via `/api/log-event`)
- **Styling:** Tailwind CSS

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── call-contact/route.ts   # Twilio call trigger
│   │   └── log-event/route.ts      # n8n event logging
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Main page with disclaimer
├── components/
│   └── EmergencyCoach.tsx          # Main UI component
├── hooks/
│   └── useElevenLabsAgent.ts       # ElevenLabs WebSocket hook
└── ...
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- ElevenLabs account with a Conversational AI agent configured
- Twilio account (for phone call functionality)
- n8n instance (optional, for event logging)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# =============================================================================
# ELEVENLABS CONFIGURATION
# =============================================================================
# Get these from your ElevenLabs dashboard
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id

# =============================================================================
# TWILIO CONFIGURATION
# =============================================================================
# Get these from your Twilio console
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX  # Your Twilio phone number

# Number that will receive calls when emergency contact is triggered
# If not set, defaults to developer test number (+15129029090)
# WARNING: Never set this to 911 or any real emergency service number
DISPATCH_TARGET_NUMBER=+1XXXXXXXXXX

# =============================================================================
# N8N LOGGING (Optional)
# =============================================================================
# Webhook URL for logging events to n8n
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/lifeline-events
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## API Endpoints

### POST `/api/call-contact`

Triggers a phone call to the configured dispatch number.

**Request Body:**
```json
{
  "summary": "Brief description of the emergency situation"
}
```

**Response:**
```json
{
  "success": true,
  "callSid": "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

⚠️ **Safety Note:** This endpoint dials `DISPATCH_TARGET_NUMBER` or falls back to a developer test number. It is strictly forbidden to configure this to dial 911 or any emergency service directly.

### POST `/api/log-event`

Logs events to the configured n8n webhook.

**Request Body:**
```json
{
  "type": "conversation_started",
  "sessionId": "uuid-here",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": { ... }
}
```

**Event Types:**
- `conversation_started` - User started a voice session
- `conversation_stopped` - User ended the session
- `call_contact_triggered` - Emergency contact call was initiated
- `error` - An error occurred

## ElevenLabs Agent Configuration

The ElevenLabs agent should be configured in the ElevenLabs dashboard with:

1. **System Prompt** that includes safety guidelines:
   - Always identify as an AI assistant, not a medical professional
   - Encourage calling emergency services for serious situations
   - Never provide medical diagnoses
   - Remain calm and supportive

2. **Special Tags** the agent can use:
   - `[[CALL_EMERGENCY_CONTACT]]` - Prefix to trigger an emergency contact call
   - `[[LINKS]]` - Followed by semicolon-separated resources (e.g., `[[LINKS]]CPR Guide:https://example.com;Poison Control:1-800-222-1222`)

## Development Notes

### TODOs in the Codebase

The `useElevenLabsAgent.ts` hook contains TODO comments marking areas that may need adjustment based on the exact ElevenLabs WebSocket protocol. Review these if you encounter issues connecting.

### Audio Format

The hook is configured for:
- Sample Rate: 16kHz
- Channels: Mono
- Format: 16-bit PCM (base64 encoded for WebSocket)

Adjust these settings if your ElevenLabs agent expects different audio parameters.

## License

This project is for demonstration and educational purposes.

## Disclaimer

This software is provided "as is" without warranty of any kind. The developers are not responsible for any harm that may result from using this application. Always prioritize calling professional emergency services in real emergency situations.
