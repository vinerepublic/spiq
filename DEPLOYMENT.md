# Deployment Guide

This guide covers deploying Spiq to production, including building, submitting to app stores, and post-launch maintenance.

## Prerequisites

Before deploying, ensure you have:

- [ ] Completed all items in [SECURITY.md](SECURITY.md) checklist
- [ ] Updated bundle IDs to your organization in `app.config.ts`
- [ ] Created app icons and splash screens
- [ ] Hosted privacy policy on your domain
- [ ] Set up Apple Developer account ($99/year) for iOS
- [ ] Set up Google Play Console account ($25 one-time) for Android
- [ ] Configured secrets management (remove hardcoded API keys)
- [ ] Tested app thoroughly on physical devices

## Environment Setup

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Login to Expo

```bash
eas login
```

### 3. Configure EAS Project

```bash
eas init
```

## Building for Production

### iOS Production Build

#### Step 1: Configure Code Signing

```bash
# Let EAS manage certificates (recommended for first-time)
eas build:configure
```

Or manually:
- Create iOS Distribution Certificate in Apple Developer portal
- Create App Store Provisioning Profile
- Add to EAS credentials

#### Step 2: Update Build Configuration

Edit `eas.json` production build:

```json
{
  "build": {
    "production": {
      "ios": {
        "buildType": "release",
        "scheme": "spiq",
        "distribution": "store"
      }
    }
  }
}
```

#### Step 3: Build

```bash
eas build --platform ios --profile production
```

Build time: ~20-30 minutes

### Android Production Build

#### Step 1: Configure Signing

```bash
# Generate keystore (first time only)
eas credentials:configure
```

Or use existing keystore:
- Add keystore file to EAS credentials
- Provide keystore password, key alias, and key password

#### Step 2: Update Build Configuration

Edit `eas.json` production build:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

#### Step 3: Build

```bash
eas build --platform android --profile production
```

Build time: ~15-25 minutes

## Submitting to App Stores

### iOS App Store Submission

#### Option 1: Automatic Submission via EAS

```bash
eas submit --platform ios --latest
```

This will:
1. Upload IPA to App Store Connect
2. You still need to complete metadata in App Store Connect
3. Submit for review manually

#### Option 2: Manual Submission

1. Download IPA from EAS dashboard
2. Open **Transporter** app on Mac
3. Drag IPA into Transporter
4. Wait for upload to complete
5. Go to [App Store Connect](https://appstoreconnect.apple.com)
6. Complete app metadata (see [APP_STORE.md](APP_STORE.md))
7. Submit for review

#### App Store Connect Configuration

1. **General Info**
   - Name: Spiq
   - Subtitle: Voice Interface for OpenClaw AI
   - Category: Productivity
   - Primary Language: English

2. **Pricing & Availability**
   - Price: Free
   - Availability: All countries (or select specific countries)

3. **App Privacy**
   - Complete privacy questionnaire
   - Link to hosted privacy policy

4. **App Review Information**
   - Contact: Your email
   - Phone: Your phone
   - Review notes: See APP_STORE.md
   - Demo account: Not required (mock mode available)

5. **Version Information**
   - Screenshots (6.7", 6.5", 5.5", iPad)
   - Description
   - Keywords
   - Support URL
   - Marketing URL (optional)

6. **Build Selection**
   - Select uploaded build
   - Set build for release

7. **Submit for Review**

Expected review time: 1-7 days

### Android Play Store Submission

#### Option 1: Automatic Submission via EAS

```bash
eas submit --platform android --latest
```

#### Option 2: Manual Submission

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Complete store listing
4. Upload AAB to production track
5. Complete content rating questionnaire
6. Complete Data Safety form
7. Submit for review

#### Play Console Configuration

1. **App Details**
   - Name: Spiq
   - Short description: Mobile voice companion for OpenClaw AI
   - Full description: See APP_STORE.md

2. **Store Listing**
   - Screenshots (phone, 7" tablet, 10" tablet)
   - Feature graphic (1024x500)
   - App icon (512x512)

3. **Categorization**
   - App category: Tools
   - Tags: AI, Voice Assistant, Developer Tools

4. **Data Safety**
   - Data collection: Minimal (see PRIVACY.md)
   - Data sharing: Only with user's self-hosted Gateway
   - Security practices: Encryption in transit and at rest

5. **Content Rating**
   - Complete questionnaire
   - Expected rating: Everyone

6. **Release**
   - Production track
   - Countries: All (or select)
   - Rollout: 100% or staged (10% → 50% → 100%)

Expected review time: Hours to 3 days

## Post-Launch Checklist

### Immediate (Day 1)

- [ ] Monitor app store status (check for approval)
- [ ] Test production builds on clean devices
- [ ] Set up error monitoring (Sentry, Bugsnag, etc.)
- [ ] Monitor crash reports (Xcode Organizer, Play Console)
- [ ] Respond to initial user reviews

### Week 1

- [ ] Monitor user feedback and ratings
- [ ] Track adoption metrics
- [ ] Document common user issues
- [ ] Prepare hotfix build if critical bugs found
- [ ] Update FAQ based on user questions

### Week 2-4

- [ ] Analyze user behavior patterns
- [ ] Gather feature requests
- [ ] Plan first update (version 1.1.0)
- [ ] Update dependencies (security patches)
- [ ] Improve documentation based on feedback

## Monitoring & Maintenance

### Error Tracking

Integrate Sentry or similar:

```bash
npm install @sentry/react-native
```

Configure in `App.tsx`:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  // Don't send sensitive data
  beforeSend(event) {
    // Scrub auth tokens, API keys, etc.
    return event;
  },
});
```

### Analytics (Optional, Privacy-First)

Only if needed and with user consent:

```bash
npm install @amplitude/analytics-react-native
```

**Important:** Update privacy policy if adding analytics!

### Crash Monitoring

**iOS:** Xcode Organizer → Crashes
**Android:** Play Console → Vitals → Crashes & ANRs

Review daily for first week, then weekly.

### Performance Monitoring

Monitor key metrics:
- App launch time (< 2 seconds)
- Voice session latency (< 500ms)
- Memory usage (< 200MB)
- Battery consumption

## Updating the App

### Version Numbering

Follow semantic versioning:
- **Major (2.0.0)**: Breaking changes, major features
- **Minor (1.1.0)**: New features, backward compatible
- **Patch (1.0.1)**: Bug fixes, security patches

### Update Process

1. **Code Changes**
   ```bash
   # Update version in app.config.ts
   version: '1.0.1'
   ```

2. **Test Thoroughly**
   ```bash
   npm run validate  # typecheck, test, lint
   ```

3. **Build**
   ```bash
   eas build --platform all --profile production
   ```

4. **Submit**
   ```bash
   eas submit --platform all --latest
   ```

5. **Release Notes**
   - Keep concise (what's new, what's fixed)
   - Mention breaking changes prominently

### Hotfix Process (Critical Bugs)

1. Create hotfix branch from production tag
2. Fix bug with minimal changes
3. Increment patch version
4. Fast-track build and submission
5. Request expedited review (App Store only, for critical issues)

Expected expedited review: 1-2 days

## Rollback Strategy

If critical bug in production:

### iOS
1. Remove problematic version from sale (App Store Connect)
2. Previous version remains available to existing users
3. Submit hotfix ASAP

### Android
1. Halt staged rollout immediately (Play Console)
2. Roll back to previous version
3. Fix and resubmit

## Infrastructure & Costs

### Hosting Costs

**App Store Hosting:**
- iOS: $99/year (Apple Developer)
- Android: $25 one-time (Google Play)

**Build Infrastructure:**
- EAS Free: 30 iOS + 30 Android builds/month
- EAS Production: Unlimited builds, $299/year

**Monitoring (Optional):**
- Sentry: Free tier or $26+/month
- Analytics: Free tier usually sufficient

### Maintenance Time Estimate

- **Weekly:** 2-4 hours (monitor crashes, respond to reviews)
- **Monthly:** 4-8 hours (update dependencies, plan features)
- **Quarterly:** 8-16 hours (major update development)

## Compliance & Legal

### Required Legal Documents

- [ ] Privacy Policy (hosted, linked in stores)
- [ ] Terms of Service (recommended)
- [ ] EULA (optional, can use standard)

### Regulatory Compliance

- **GDPR (EU):** User data rights, consent, data portability
- **CCPA (California):** Similar to GDPR
- **COPPA (Children):** N/A (app not for <13 years old)

### App Store Policies

Review annually:
- [iOS App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policies](https://play.google.com/about/developer-content-policy/)

## Disaster Recovery

### Lost Access to Code

- Keep git repository in multiple locations (GitHub + backup)
- Document all build steps in this file
- Store EAS credentials securely (Expo handles this)

### Lost Apple/Google Account

- Keep record of account credentials in secure vault
- Set up 2FA with backup codes
- Have multiple administrators on accounts

### Critical Security Breach

1. Immediately revoke all API keys
2. Release emergency update with rotated keys
3. Notify users via app store description
4. Post public incident report

## Questions & Support

For deployment issues:
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **EAS Submit:** https://docs.expo.dev/submit/introduction/
- **App Store Connect:** https://developer.apple.com/support/app-store-connect/
- **Play Console:** https://support.google.com/googleplay/android-developer/

For code issues:
- **GitHub Issues:** https://github.com/[your-org]/spiq/issues
- **Email:** support@yourdomain.com

---

Good luck with your deployment! 🚀
