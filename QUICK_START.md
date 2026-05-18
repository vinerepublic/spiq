# Quick Start - Deploy to Production NOW

Your codebase is **production-ready**! Follow these steps to get into the app stores:

## ✅ Already Done

- [x] Security hardened (API keys removed, validation added)
- [x] Error handling and logging implemented
- [x] TypeScript checks passing
- [x] Dependencies installed
- [x] Committed to git

## 🚀 Deploy Steps (30 minutes)

### Step 1: Initialize EAS Project (2 mins)

```bash
npx eas init
```

**Say "yes"** when prompted to create project for `@amantes/spiq`

### Step 2: Update Bundle IDs (Optional but Recommended)

Edit `app.config.ts` and change:
```typescript
bundleIdentifier: 'com.spiq.app',        // iOS
package: 'com.spiq.app',                  // Android
```

to your organization:
```typescript
bundleIdentifier: 'com.yourcompany.spiq',  // iOS
package: 'com.yourcompany.spiq',           // Android
```

### Step 3: Build for Production (20 mins per platform)

**iOS:**
```bash
npx eas build --platform ios --profile production
```

**Android:**
```bash
npx eas build --platform android --profile production
```

**Both at once:**
```bash
npx eas build --platform all --profile production
```

Builds run on EAS servers (no local setup needed). You'll get download links when complete.

### Step 4: Test Production Builds

**iOS:**
- Download IPA from EAS dashboard
- Install via TestFlight or direct install

**Android:**
- Download AAB from EAS dashboard
- Upload to Play Console internal testing track

### Step 5: Submit to App Stores (After Testing)

**Automatic submission:**
```bash
npx eas submit --platform ios --latest
npx eas submit --platform android --latest
```

**Or manually:**
- iOS: Upload IPA via Transporter to App Store Connect
- Android: Upload AAB to Google Play Console

## 📋 Before Submitting to Stores

### Required Assets (Can do while builds run)

1. **App Icons**
   - iOS: 1024x1024 PNG (no transparency)
   - Android: 512x512 PNG

2. **Screenshots** (at least 3 per platform)
   - iOS: 6.7" display (1290x2796)
   - Android: Phone (1080x1920 minimum)

3. **Privacy Policy**
   - Host `PRIVACY.md` on your website
   - Or use GitHub Pages: `https://yourname.github.io/spiq/PRIVACY.html`

4. **App Store Metadata**
   - See `APP_STORE.md` for complete descriptions, keywords, etc.

### App Store Accounts

- **Apple Developer**: $99/year - https://developer.apple.com
- **Google Play Console**: $25 one-time - https://play.google.com/console

## 🎯 Production Gateway Setup

Your app needs a production Gateway to function. Two options:

### Option 1: Quick Start (For Testing)

Run the included Gateway locally:

```bash
cd gateway
cp .env.example .env

# Edit .env and add your API keys:
# ANTHROPIC_API_KEY=sk-ant-your-key
# OPENAI_API_KEY=sk-proj-your-key
# ELEVENLABS_API_KEY=your-key (optional)

npm install
node server.js
```

Gateway runs on http://localhost:3333

### Option 2: Production Deploy (Recommended)

Deploy Gateway to a server:

**Quick Deploy Options:**
- **Railway.app**: One-click deploy, $5-10/month
- **Render.com**: Free tier available
- **Fly.io**: Free tier available
- **AWS EC2**: More control, varies by usage

**Requirements:**
- Node.js 20+
- HTTPS (required for production)
- Environment variables for API keys

See `DEPLOYMENT.md` for detailed Gateway deployment instructions.

## 📱 Testing the App

1. **Mock Mode** (No Gateway needed)
   - Enable in Settings → "Enable Mock Mode"
   - Tests all UI without backend

2. **With Local Gateway**
   - Run gateway: `cd gateway && node server.js`
   - In app: Connect to `http://your-ip:3333`
   - Use any pairing code (mock gateway accepts all)

3. **With Production Gateway**
   - Deploy Gateway with HTTPS
   - In app: Connect to `https://your-gateway-domain.com`
   - Use real pairing codes from your Gateway

## 🔧 Troubleshooting

### Build Fails

**Check iOS provisioning:**
```bash
npx eas credentials
```

**Check Android keystore:**
```bash
npx eas credentials
```

### App Crashes on Launch

- Check bundle ID matches provisioning profile
- Verify no hardcoded API keys (there shouldn't be any)
- Check EAS build logs for errors

### Can't Connect to Gateway

- Gateway must use HTTPS in production
- Check firewall allows connections
- Verify Gateway URL in app settings

## 📊 Timeline Estimate

- **EAS Setup**: 2 minutes
- **First Build** (iOS + Android): 40-50 minutes
- **Testing**: 30 minutes
- **App Store Submission**: 30 minutes
- **Review Wait**: 1-7 days (iOS), hours-3 days (Android)

**Total to submission: ~2 hours of active work**

## 🎉 You're Almost There!

Your code is production-ready. The only remaining steps are:

1. Run `npx eas init` (2 mins)
2. Run `npx eas build --platform all --profile production` (40 mins)
3. Create app icons and screenshots while builds run (30 mins)
4. Submit to stores (30 mins)

**You could be in the app stores in 2 hours of work!**

## 📚 More Resources

- **Detailed Deployment**: See `DEPLOYMENT.md`
- **App Store Metadata**: See `APP_STORE.md`
- **Security Guidelines**: See `SECURITY.md`
- **Production Checklist**: See `PRODUCTION_CHECKLIST.md`

---

Ready? Run `npx eas init` and let's go! 🚀
