# Deploy Spiq NOW - Complete Checklist

Everything is ready! Follow these steps in order.

## ✅ Already Completed

- [x] Security hardened (all API keys removed)
- [x] Code quality verified (TypeScript passes)
- [x] Dependencies installed
- [x] App icons ready (in ./assets/)
- [x] Gateway configured with dependencies
- [x] Documentation complete
- [x] Git commits clean

## 🚀 Deployment Steps (Execute Now)

### Step 1: Initialize EAS (2 minutes) - **DO THIS FIRST**

Open your terminal and run:

```bash
npx eas init
```

**When prompted:**
- "Would you like to create a project for @amantes/spiq?" → Type **y** and press Enter

**Expected output:**
```
✔ EAS project created: https://expo.dev/accounts/amantes/projects/spiq
```

Copy the project ID for reference.

---

### Step 2: Start Production Builds (50 minutes automated)

After EAS init completes, run:

```bash
npx eas build --platform all --profile production
```

**What happens:**
- EAS builds iOS and Android on cloud servers
- No local Xcode or Android Studio needed
- Builds take ~20-25 minutes each
- You'll get download links when complete

**While builds run, continue to Step 3...**

---

### Step 3: Deploy Production Gateway (15 minutes)

Choose your deployment method:

#### Option A: Railway.app (Easiest - Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
cd gateway
railway init
railway up

# Set environment variables (use your real API keys)
railway variables set ANTHROPIC_API_KEY=sk-ant-your-key-here
railway variables set OPENAI_API_KEY=sk-proj-your-key-here
railway variables set ELEVENLABS_API_KEY=your-key-here
railway variables set PORT=3333

# Get your Gateway URL
railway domain
```

**Your Gateway URL will be:** `https://your-app.railway.app`

#### Option B: Render.com (Free Tier)

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Name:** spiq-gateway
   - **Root Directory:** gateway
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `PORT` = 3333
6. Click "Create Web Service"

**Your Gateway URL will be:** `https://spiq-gateway.onrender.com`

#### Option C: Test Locally First

```bash
cd gateway

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # Add your keys

# Start Gateway
npm start
```

**Gateway runs on:** `http://localhost:3333`

**Note:** For production app submission, you MUST use a cloud deployment (Railway/Render) with HTTPS.

---

### Step 4: Test Your Gateway (2 minutes)

```bash
# Test health endpoint (replace with your Gateway URL)
curl https://your-gateway-url.com/health

# Expected response:
# {"ok":true,"status":"live","gateway":"spiq-gateway","version":"1.0.0"}
```

If you see the response above, your Gateway is ready! ✅

---

### Step 5: Update App Configuration (1 minute)

Edit `.env` and set your production Gateway URL:

```bash
# Update this line with your Gateway URL from Step 3
EXPO_PUBLIC_OPENCLAW_DEFAULT_GATEWAY_URL=https://your-gateway-url.com
```

**Then rebuild:**
```bash
npx eas build --platform all --profile production
```

---

### Step 6: Download and Test Builds (30 minutes)

When builds complete, you'll get links like:
- iOS: `https://expo.dev/artifacts/eas/...`
- Android: `https://expo.dev/artifacts/eas/...`

#### Test iOS Build:
```bash
# Download IPA
# Option 1: Install via TestFlight (recommended)
#   - Upload to App Store Connect
#   - Invite yourself as tester

# Option 2: Direct install (development)
#   - Download IPA
#   - Use Xcode → Window → Devices and Simulators
#   - Drag IPA to device
```

#### Test Android Build:
```bash
# Download AAB
# Install via:
#   - Google Play Internal Testing
#   - Or use bundletool to create APK
```

**Test Checklist:**
- [ ] App launches without crashing
- [ ] Can connect to Gateway
- [ ] Can pair (use any code with mock Gateway)
- [ ] Can select agent
- [ ] Voice session starts
- [ ] Can hear responses

---

### Step 7: Prepare App Store Submission (30 minutes)

#### Create App Store Accounts:
- [ ] Apple Developer: https://developer.apple.com ($99/year)
- [ ] Google Play Console: https://play.google.com/console ($25 one-time)

#### Prepare Metadata:

**Copy from APP_STORE.md:**
- App name: "Spiq"
- Descriptions (short and long)
- Keywords
- Screenshots (need at least 3)
- Privacy policy URL

#### Host Privacy Policy:

Quick option - GitHub Pages:
```bash
# Create gh-pages branch
git checkout -b gh-pages
git push origin gh-pages

# Your privacy policy will be at:
# https://yourusername.github.io/spiq/PRIVACY.html
```

Or host on your own domain.

---

### Step 8: Submit to App Stores (30 minutes)

#### iOS App Store:

1. **Upload to App Store Connect:**
   ```bash
   npx eas submit --platform ios --latest
   ```
   Or manually via Transporter app

2. **Complete App Store Connect:**
   - Go to https://appstoreconnect.apple.com
   - Select your app
   - Fill in metadata (from APP_STORE.md)
   - Add screenshots
   - Select build
   - Submit for review

**Review time:** 1-7 days

#### Android Play Store:

1. **Upload to Play Console:**
   ```bash
   npx eas submit --platform android --latest
   ```
   Or manually upload AAB

2. **Complete Play Console:**
   - Go to https://play.google.com/console
   - Create app
   - Fill in store listing (from APP_STORE.md)
   - Add screenshots
   - Complete Data Safety form
   - Complete Content Rating questionnaire
   - Upload AAB to production track
   - Submit for review

**Review time:** Hours to 3 days

---

## 📊 Timeline

| Step | Time | Can Run in Parallel? |
|------|------|---------------------|
| 1. EAS init | 2 min | No |
| 2. Start builds | 50 min (automated) | Yes - continue to Step 3 |
| 3. Deploy Gateway | 15 min | Yes - while builds run |
| 4. Test Gateway | 2 min | No - wait for Gateway |
| 5. Update config & rebuild | 50 min (automated) | No |
| 6. Test builds | 30 min | No |
| 7. Prepare metadata | 30 min | Yes - while builds run |
| 8. Submit to stores | 30 min | No |

**Total active time:** ~2-3 hours
**Total elapsed time:** ~4-5 hours (with build waits)

---

## 🎯 Quick Start (Minimum Viable Deployment)

If you want to test ASAP:

```bash
# 1. EAS init
npx eas init

# 2. Build (test with mock mode - no Gateway needed)
npx eas build --platform android --profile development

# 3. Test on device with mock mode
# No Gateway deployment needed for initial testing!
```

Then deploy Gateway and rebuild for production when ready.

---

## ✅ Pre-Flight Checklist

Before submitting to stores, verify:

- [ ] EAS project initialized
- [ ] Production builds completed successfully
- [ ] Gateway deployed and responding to /health
- [ ] App tested on physical device
- [ ] No crashes or critical bugs
- [ ] Privacy policy hosted
- [ ] App Store/Play Console accounts created
- [ ] All metadata prepared (descriptions, screenshots, etc.)
- [ ] Bundle IDs match certificates (iOS)
- [ ] Keystore configured (Android)

---

## 🆘 Troubleshooting

**EAS init fails:**
- Check internet connection
- Verify you're logged in: `npx eas-cli whoami`
- Try: `npx eas-cli logout` then `npx eas-cli login`

**Build fails:**
- Check build logs in EAS dashboard
- iOS: Verify bundle ID and provisioning
- Android: Verify keystore configuration
- Common fix: `npx eas build:configure`

**Gateway not responding:**
- Check deployment logs
- Verify environment variables are set
- Test locally first: `cd gateway && npm start`
- Check CORS configuration

**App crashes on launch:**
- Check for hardcoded API keys (shouldn't have any)
- Verify bundle ID matches build profile
- Check device logs (Xcode or adb logcat)

---

## 🎉 You're Ready!

Run `npx eas init` right now and let's get Spiq into production!

**Questions?** Check:
- DEPLOYMENT.md - Detailed deployment guide
- APP_STORE.md - App store metadata
- SECURITY.md - Security best practices
- Gateway README.md - Gateway deployment options

Good luck! 🚀
