# App Store Metadata

This document contains all the metadata needed for Apple App Store and Google Play Store submissions.

## App Information

### Basic Info

**App Name:** Spiq

**Subtitle (iOS):** Voice Interface for OpenClaw AI

**Short Description (Android):** Mobile voice companion for self-hosted OpenClaw AI agents

**Bundle ID (iOS):** `com.spiq.app` (Update to your organization's bundle ID)

**Package Name (Android):** `com.spiq.app` (Update to your organization's package name)

**Version:** 1.0.0

**SKU:** spiq-mobile-001

### Long Description (500 chars for App Store, 4000 for Play Store)

Spiq is a mobile voice companion for your self-hosted OpenClaw AI agents. Connect to your OpenClaw Gateway, select an agent, and have natural voice conversations with cutting-edge AI assistants.

**Key Features:**
- 🎤 Natural voice conversations with AI agents
- ⚡ Ultra-low latency (200-300ms with OpenAI Realtime)
- 🔒 Secure, private, self-hosted
- 🌐 Connect to your own OpenClaw Gateway
- 👥 Multi-agent conference calling
- 📝 Real-time transcripts
- 🎨 ChatGPT-style beautiful interface
- 🌓 Dark mode support

**Supported Voice Transports:**
- OpenAI Realtime (recommended): Direct WebRTC for lowest latency
- LiveKit: Self-hosted low-latency sessions
- Legacy: Traditional STT → text → TTS flow

**Privacy First:**
- All data stays on your device and your Gateway
- No analytics or tracking
- Encrypted local storage
- Full control over your conversations

**Requirements:**
- Self-hosted OpenClaw Gateway (not included)
- Microphone permission for voice input
- Internet connection to your Gateway

Spiq is open source and built with modern React Native, Expo, and TypeScript.

Perfect for developers, teams, and organizations running their own AI infrastructure.

---

### Keywords (100 chars max, comma-separated)

AI, voice assistant, OpenClaw, self-hosted, voice chat, AI agent, speech recognition, real-time, private AI, conversation

### Category

**Primary Category:** Productivity

**Secondary Category (iOS):** Developer Tools

**Android Category:** Tools

### Content Rating

**iOS:** 4+ (No restricted content)

**Android:** Everyone

### Support Information

**Support URL:** https://github.com/[your-org]/spiq

**Marketing URL:** https://yourdomain.com/spiq (optional)

**Privacy Policy URL:** https://yourdomain.com/privacy (required before submission)

**Support Email:** support@yourdomain.com

### Promotional Text (iOS, 170 chars)

Experience the future of AI conversation. Connect to your OpenClaw Gateway and talk naturally with powerful AI agents. Private, fast, and fully under your control.

## Screenshots

### Required Screenshot Sizes

#### iOS
- 6.7" (iPhone 15 Pro Max): 1290 x 2796 px
- 6.5" (iPhone 14 Plus): 1284 x 2778 px
- 5.5" (iPhone 8 Plus): 1242 x 2208 px
- 12.9" (iPad Pro): 2048 x 2732 px

#### Android
- Phone: 1080 x 1920 px (minimum)
- 7" Tablet: 1200 x 1920 px
- 10" Tablet: 1600 x 2560 px

### Screenshot Ideas

1. **Onboarding Screen** - "Connect to Your OpenClaw Gateway"
2. **Agent Selection** - "Choose Your AI Agent"
3. **Voice Chat** - "Natural Voice Conversations"
4. **Swipe Interface** - "Intuitive Agent Selection"
5. **Transcript View** - "Real-Time Transcripts"
6. **Settings** - "Customizable Experience"

## App Preview Videos (Optional)

### iOS App Preview
- 30 seconds max
- Portrait orientation
- Showcase: Connection → Agent Selection → Voice Chat

### Google Play Video
- 30 seconds to 2 minutes
- Showcase full workflow with voiceover

## Release Notes

### Version 1.0.0 (Initial Release)

Welcome to Spiq, your voice companion for OpenClaw AI agents!

**Features:**
- Connect to self-hosted OpenClaw Gateway
- Natural voice conversations with AI agents
- Ultra-low latency with OpenAI Realtime support
- Multi-agent conference calling
- Real-time transcripts
- Swipe-based agent selection
- Dark mode support
- Secure encrypted storage

**Requirements:**
- Self-hosted OpenClaw Gateway
- Microphone permission

We're excited to bring voice AI to your mobile device. Please report any issues on our GitHub repository.

---

## Submission Checklist

### Pre-Submission

- [ ] Update bundle ID/package name to your organization
- [ ] Create app icons (iOS: 1024x1024, Android: 512x512)
- [ ] Prepare all required screenshots
- [ ] Host privacy policy on your domain
- [ ] Set up support email and website
- [ ] Configure app signing (iOS: provisioning profiles, Android: keystore)
- [ ] Test on multiple devices
- [ ] Run full test suite
- [ ] Remove all API keys from code
- [ ] Ensure Gateway ephemeral token generation works

### iOS App Store Specific

- [ ] Apple Developer account ($99/year)
- [ ] Create App Store Connect listing
- [ ] Upload build via Xcode or Transporter
- [ ] Complete App Privacy details
- [ ] Add IDFA declaration (select "No" if not using ads/tracking)
- [ ] Submit for review (typically 1-3 days)

### Google Play Store Specific

- [ ] Google Play Console account ($25 one-time)
- [ ] Create Play Console listing
- [ ] Upload AAB (Android App Bundle)
- [ ] Complete Data Safety form
- [ ] Add content rating questionnaire
- [ ] Submit for review (typically hours to 1 day)

### Post-Submission

- [ ] Monitor review status daily
- [ ] Respond to any reviewer questions within 24 hours
- [ ] Test production build after approval
- [ ] Announce launch on social media
- [ ] Monitor crash reports and user feedback
- [ ] Plan first update based on feedback

## App Store Review Tips

### Common Rejection Reasons & Solutions

1. **Missing Privacy Policy**
   - Solution: Host PRIVACY.md on your website before submission

2. **Permissions Not Explained**
   - Solution: Already configured in app.config.ts with clear descriptions

3. **Crashes on Launch**
   - Solution: Test thoroughly on clean devices, ensure no hardcoded API keys

4. **Requires External Hardware/Setup**
   - Solution: Clearly state in description that Gateway is required
   - Provide mock mode for reviewers (already implemented)

5. **Misleading Metadata**
   - Solution: Be honest about Gateway requirement, don't oversell features

### Reviewer Notes (Optional Field)

"Spiq requires a self-hosted OpenClaw Gateway to function. For review purposes, the app includes a mock mode that can be enabled in Settings → Enable Mock Mode. This allows testing all UI features without a Gateway.

To test with a real Gateway:
1. Run the included gateway/server.js on your machine
2. Configure Gateway URL as http://[your-ip]:3333
3. Use any pairing code (mock gateway accepts all)

No special accounts or credentials needed. Microphone permission will be requested on first voice session."

## Asset Requirements Summary

### Icons

| Platform | Size | Format | Notes |
|----------|------|--------|-------|
| iOS App Store | 1024x1024 | PNG | No transparency, no alpha |
| iOS App | Various | PNG | Auto-generated from 1024x1024 |
| Android Play Store | 512x512 | PNG | 32-bit with alpha |
| Android App | Various | PNG | Auto-generated adaptive icons |

### Feature Graphic (Android)

- Size: 1024 x 500 px
- Format: PNG or JPEG
- Content: App logo + tagline

## Timeline Estimate

- **iOS:** 2-7 days from submission to approval
- **Android:** 1-3 days from submission to approval
- **Total Preparation:** 3-5 days (metadata, screenshots, testing)

## Questions?

For app store submission questions, refer to:
- [iOS App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policy](https://play.google.com/about/developer-content-policy/)
- [Expo EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
