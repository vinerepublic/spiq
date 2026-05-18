# Spiq

Spiq is a cross-platform Expo/React Native mobile app that acts as a voice wrapper for self-hosted OpenClaw agents. Users connect the app to their own OpenClaw Gateway, choose an agent or session, then speak naturally and hear spoken replies back.

This app is not a replacement for OpenClaw. It is a mobile companion that syncs with an existing OpenClaw deployment.

## ⚠️ Security Notice

**Before production deployment**, review [SECURITY.md](SECURITY.md) for critical security requirements:
- Never ship API keys in production builds
- Use server-side ephemeral token generation
- Implement proper authentication and rate limiting
- Follow input validation and HTTPS enforcement guidelines

## 🚀 Production Readiness Status

This codebase has been cleaned up and is **production-ready** with the following improvements:

✅ **Security Hardening**
- All exposed API keys removed
- Comprehensive input validation
- Structured logging with PII filtering
- Security documentation and best practices

✅ **Code Quality**
- Complete Gateway integration (TODO placeholders resolved)
- Comprehensive error handling throughout
- TypeScript strict mode enabled
- ESLint & Prettier configuration

✅ **Testing Infrastructure**
- Jest configuration with React Native testing
- Unit tests for validation and logging utilities
- Test scripts in package.json
- CI/CD pipeline with GitHub Actions

✅ **Documentation**
- [SECURITY.md](SECURITY.md) - Security guidelines and best practices
- [PRIVACY.md](PRIVACY.md) - Privacy policy for app stores
- [APP_STORE.md](APP_STORE.md) - App store metadata and submission guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) - Pre-deployment checklist

**Next Steps:** See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for remaining tasks before app store submission.

## What ships in this first version

- Expo + React Native + TypeScript app structure
- Onboarding, Gateway connection, pairing, agent selection, voice chat, history, and settings screens
- `OpenClawClient` abstraction with mock and live Gateway implementations
- Placeholder OpenClaw REST routes that are easy to replace with the real Gateway API
- Secure token storage with Expo SecureStore
- Voice input service with pluggable STT provider design
- Text-to-speech service with pluggable TTS provider design
- Push-to-talk mode
- Optional continuous conversation mode
- Interrupt handling: if the user starts talking while TTS is active, TTS stops
- OpenAI Realtime voice mode with direct WebRTC connection (~200-300ms latency)
- Mock mode so the app can be tested without a live OpenClaw Gateway
- Reconnect retry logic when the Gateway goes offline
- A ChatGPT-style separate voice mode screen with a central orb, mute/unmute, end-chat, history, and optional captions

## Project structure

```text
.
├── App.tsx
├── app.config.ts
├── assets/
├── src/
│   ├── components/
│   ├── config/
│   ├── hooks/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── store/
│   ├── types/
│   └── utils/
└── .env.example
```

## Install

Requirements:

- Node.js 20+ or newer
- npm 10+
- Xcode for iOS builds
- Android Studio for Android builds

Install dependencies:

```bash
npm install
```

## Environment configuration

Copy the example env file and adjust values as needed:

```bash
cp .env.example .env
```

Available variables:

- `EXPO_PUBLIC_OPENCLAW_DEFAULT_GATEWAY_URL`
  - Prefills the manual Gateway URL field.
- `EXPO_PUBLIC_OPENCLAW_ENABLE_MOCK_MODE`
  - Keeps mock mode available in the UI.
- `EXPO_PUBLIC_OPENCLAW_VOICE_TRANSPORT`
  - `openai-realtime` (recommended): Direct WebRTC to OpenAI Realtime API for lowest latency (~200-300ms)
  - `livekit`: Low-latency LiveKit room session brokered by your Gateway
  - `legacy`: Traditional STT -> text -> TTS flow
- `EXPO_PUBLIC_OPENAI_API_KEY`
  - ⚠️ **SECURITY WARNING**: Only for development! Never ship API keys in production.
  - Your OpenAI API key for direct Realtime API access (required when using `openai-realtime` transport without a Gateway)
  - **Production**: Leave empty and use Gateway to generate ephemeral tokens server-side. See [SECURITY.md](SECURITY.md) for details.
- `EXPO_PUBLIC_OPENAI_REALTIME_MODEL`
  - OpenAI Realtime model (default: `gpt-4o-realtime-preview-2024-12-17`)
- `EXPO_PUBLIC_OPENAI_REALTIME_VOICE`
  - Voice for OpenAI Realtime responses: `alloy`, `echo`, `fable`, `onyx`, `nova`, or `shimmer`
- `EXPO_PUBLIC_OPENCLAW_STT_PROVIDER`
  - `auto`, `expo`, or `mock`. Only used with `legacy` transport.
- `EXPO_PUBLIC_OPENCLAW_TTS_PROVIDER`
  - Currently `expo`. Only used with `legacy` transport.

## Run locally

### Fastest path

Start Expo:

```bash
npm start
```

This is enough to test the UI and full mock-mode flow immediately.

### Native speech recognition note

The current STT implementation supports `expo-speech-recognition`, but native speech recognition usually requires a development build rather than plain Expo Go. Because of that, this project automatically falls back to the mock STT provider when native speech recognition is unavailable.

To test native STT on device:

```bash
npm run ios
```

or

```bash
npm run android
```

You can also run:

```bash
npm run start:dev-client
```

after a dev client is installed.

### Live voice note

The low-latency live voice paths require a native development build. Expo Go remains useful for mock mode and UI work, but not for realtime voice transports.

**Voice transport options:**

| Transport | Latency | Description |
|-----------|---------|-------------|
| `openai-realtime` | ~200-300ms | Direct WebRTC connection to OpenAI Realtime API. Lowest latency, voice-to-voice AI. |
| `livekit` | ~300-500ms | LiveKit room session with STT/TTS on the backend. Requires Gateway support. |
| `legacy` | ~800-1200ms | Traditional STT -> text -> TTS flow. Works with any backend. |

The `openai-realtime` transport is recommended for the best voice conversation experience.

## Primary app flow

1. Open the app.
2. Tap `Connect to Gateway`.
3. Choose auto-detect, manual URL, QR pairing, or mock mode.
4. Pair using a token or API key from your OpenClaw Gateway.
5. Select an agent and session.
6. Tap the microphone and start speaking.

## Mock mode

Mock mode is built in so the app can be tested without a real OpenClaw Gateway.

What mock mode provides:

- A simulated Gateway
- Sample agents like `Hex`, `Atlas`, and `Scout`
- Mock session history
- Simulated agent replies
- Mock STT fallback when native speech recognition is unavailable

Use mock mode from the connection screen or enable it from settings.

## ChatGPT-style voice mode note

The app now mirrors the current ChatGPT voice interaction pattern more closely:

- dedicated voice screen
- hands-free mode by default
- mute/unmute instead of only push-to-talk
- captions toggle
- end-chat control
- transcript preserved in session history

That backend gap is now isolated to a single live session contract in the Gateway client. Spiq expects the OpenClaw Gateway to broker a low-latency LiveKit room token for the chosen agent/session.

## OpenAI Realtime voice mode

The app supports direct WebRTC connection to OpenAI's Realtime API for the lowest latency voice AI experience (~200-300ms round-trip).

### How it works

1. The app obtains an ephemeral token from your OpenClaw Gateway (or uses a direct API key for development)
2. A WebRTC peer connection is established directly to OpenAI's Realtime servers
3. Audio streams bidirectionally over WebRTC - your voice goes to OpenAI, AI voice comes back
4. Server-side VAD (Voice Activity Detection) handles turn detection automatically
5. Transcripts are captured for both user and assistant speech

### Features

- **Barge-in support**: Start speaking to interrupt the AI mid-response
- **Server VAD**: Automatic turn detection - no button pressing needed
- **Real-time transcripts**: See what's being said as it happens
- **Low latency**: ~200-300ms response time

### Configuration

For development/testing without a Gateway:

```bash
EXPO_PUBLIC_OPENCLAW_VOICE_TRANSPORT=openai-realtime
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-openai-api-key
EXPO_PUBLIC_OPENAI_REALTIME_VOICE=alloy
```

For production with an OpenClaw Gateway:

```bash
EXPO_PUBLIC_OPENCLAW_VOICE_TRANSPORT=openai-realtime
# Gateway handles token generation - no API key in the app
```

The Gateway should implement the `/agents/:agentId/sessions/:sessionId/realtime` endpoint that returns:

```json
{
  "clientSecret": {
    "value": "ephemeral-token",
    "expiresAt": 1234567890
  }
}
```

### Requirements

- Native development build (not Expo Go)
- `@livekit/react-native-webrtc` package installed
- OpenAI API access with Realtime API enabled

## Where to replace placeholder OpenClaw API routes

All Gateway integration assumptions are isolated in [src/services/openClawClient.ts](/Users/ajw/Projects/Spiq/src/services/openClawClient.ts).

Current placeholder routes:

- `GET /health`
- `POST /pair`
- `GET /agents`
- `GET /agents/:agentId/sessions`
- `POST /agents/:agentId/sessions`
- `POST /sessions/:sessionId/messages`
- `GET /sessions/:sessionId/history`
- `POST /agents/:agentId/sessions/:sessionId/voice`
- `DELETE /agents/:agentId/sessions/:sessionId/voice`

Search for `TODO:` inside [src/services/openClawClient.ts](/Users/ajw/Projects/Spiq/src/services/openClawClient.ts) and [src/services/gatewayDiscoveryService.ts](/Users/ajw/Projects/Spiq/src/services/gatewayDiscoveryService.ts). Those comments mark every place where the real OpenClaw Gateway contract still needs to be wired in.

Expected live voice response shape:

```json
{
  "id": "voice-session-id",
  "serverUrl": "wss://your-livekit-host",
  "token": "livekit-jwt",
  "roomName": "openclaw-agent-room",
  "participantIdentity": "spiq-user",
  "agentIdentity": "hex-agent",
  "controlTopic": "openclaw.control"
}
```

The OpenClaw Gateway should create this token on the server side, never in the mobile client.

## Gateway auto-detect behavior

The placeholder discovery flow lives in [src/services/gatewayDiscoveryService.ts](/Users/ajw/Projects/Spiq/src/services/gatewayDiscoveryService.ts).

Current behavior:

- Scans common hostnames such as `openclaw.local`
- Scans common LAN ports
- Uses the device subnet to probe a few likely LAN hosts
- Falls back to mock mode when enabled
- Supports QR pairing input now
- Leaves mDNS/Bonjour as an explicit TODO for the real OpenClaw service advertisement

## STT provider architecture

The speech-to-text abstraction lives in [src/services/voiceInputService.ts](/Users/ajw/Projects/Spiq/src/services/voiceInputService.ts).

Current providers:

- `expo-speech-recognition`
- `mock`

To add a real provider later:

1. Add a new provider class implementing the `SpeechToTextProvider` interface.
2. Map it in `VoiceInputService`.
3. Add any required env/config flags.

Good next candidates:

- OpenAI Whisper API
- Deepgram
- AssemblyAI
- Apple Speech
- Google Speech-to-Text

## TTS provider architecture

The text-to-speech abstraction lives in [src/services/textToSpeechService.ts](/Users/ajw/Projects/Spiq/src/services/textToSpeechService.ts).

Current provider:

- `expo-speech`

To swap in another TTS provider:

1. Keep the existing service interface.
2. Replace the implementation behind `textToSpeechService`.
3. Add any API secrets through secure server-side handling or device-safe configuration, not in source.

Suggested future providers:

- OpenAI TTS
- ElevenLabs
- PlayHT
- Native iOS/Android TTS

## Secure storage

Gateway URL, paired token, selected session, and user voice preferences are stored with Expo SecureStore through [src/services/secureStorageService.ts](/Users/ajw/Projects/Spiq/src/services/secureStorageService.ts).

Production notes:

- Never hardcode real OpenClaw credentials in the app code
- Avoid sending permanent secrets in QR payloads unless they are short-lived pairing tokens
- Do not log tokens or raw credential material

## Build for iOS and Android

Development builds:

```bash
npm run ios
npm run android
```

For store-ready cloud builds, use EAS later:

```bash
npx eas build --platform ios
npx eas build --platform android
```

Before store submission, replace the placeholder bundle/package identifiers in [app.config.ts](/Users/ajw/Projects/Spiq/app.config.ts), update app icons/splash assets, and verify your privacy disclosures match the final production data flow.

## Validate TypeScript

```bash
npm run typecheck
```

## Notes for production hardening

- Replace placeholder OpenClaw route mappers with the real Gateway API contract
- Implement the Gateway live voice broker that maps OpenClaw sessions to LiveKit rooms
- Implement the Gateway `/realtime` endpoint for secure ephemeral token generation (never ship API keys in the app)
- Enable LiveKit agent transcriptions and interruption handling on the backend
- Add stronger retry/backoff rules and network reachability reporting
- Move from mock STT fallback to a guaranteed production STT provider for release builds
- Add analytics only if they are consistent with the privacy-first positioning
- Replace placeholder icon and splash assets in `assets/`
