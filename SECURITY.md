# Security Guidelines for Spiq

## Overview

Spiq is a voice interface for AI agents that requires careful security considerations, especially around API key management and user data protection.

## Critical Security Requirements

### 1. API Key Management

#### ❌ NEVER DO THIS (Development Anti-Patterns)

```env
# WRONG: Exposed API key in client app
EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-abc123...
```

**Why this is dangerous:**
- The `EXPO_PUBLIC_` prefix exposes the variable to the client bundle
- Users can extract API keys from your app binary using tools like `strings` or decompilers
- Anyone with the key can use your OpenAI account, costing you money
- Rate limits and quotas can be exhausted by malicious users

#### ✅ CORRECT APPROACH (Production Pattern)

**Server-Side Token Generation:**

```javascript
// Gateway generates ephemeral tokens
app.post('/agents/:agentId/sessions/:sessionId/realtime', async (req, res) => {
  // Validate user authentication
  if (!isValidAuthToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Generate ephemeral token (expires in 1 hour)
  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // Server-side only
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: agent.voice,
      // ... other config
    }),
  });

  const data = await response.json();

  // Return ephemeral token to client (safe - expires quickly)
  res.json({
    clientSecret: {
      value: data.client_secret.value,
      expiresAt: data.client_secret.expires_at,
    },
  });
});
```

**Client Usage:**
```typescript
// Client requests ephemeral token from Gateway
const response = await openClawClient.createLiveVoiceSession(agentId, sessionId);
const ephemeralToken = response.ephemeralKey;

// Use ephemeral token (expires in ~1 hour, safe to use)
connectToOpenAI(ephemeralToken);
```

### 2. Environment Variables

#### Development (.env - NEVER COMMIT)

```env
# .env - Local development only, NEVER commit this file
EXPO_PUBLIC_OPENCLAW_DEFAULT_GATEWAY_URL=http://localhost:3333
EXPO_PUBLIC_OPENCLAW_ENABLE_MOCK_MODE=false
EXPO_PUBLIC_OPENCLAW_VOICE_TRANSPORT=openai-realtime

# These should be EMPTY in committed .env
# Set them locally for development only
EXPO_PUBLIC_OPENAI_API_KEY=

# Gateway needs these (server-side)
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-proj-your-key-here
ELEVENLABS_API_KEY=your-key-here
```

#### Production (.env.production)

```env
# .env.production - Production configuration
EXPO_PUBLIC_OPENCLAW_DEFAULT_GATEWAY_URL=https://gateway.yourdomain.com
EXPO_PUBLIC_OPENCLAW_ENABLE_MOCK_MODE=false
EXPO_PUBLIC_OPENCLAW_VOICE_TRANSPORT=openai-realtime

# NEVER set API keys here
EXPO_PUBLIC_OPENAI_API_KEY=
```

### 3. Secrets Management

#### For Production Deployments

**Use a secrets management service:**

- **AWS Secrets Manager**: Rotate keys automatically, audit access
- **Google Cloud Secret Manager**: Integrated with GCP services
- **Azure Key Vault**: For Azure deployments
- **HashiCorp Vault**: Self-hosted, enterprise-grade
- **Doppler**: Developer-friendly secrets management

**Example with AWS Secrets Manager:**

```javascript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getOpenAIKey() {
  const command = new GetSecretValueCommand({
    SecretId: 'prod/spiq/openai-api-key',
  });

  const response = await client.send(command);
  return response.SecretString;
}

// Use in Gateway
const OPENAI_API_KEY = await getOpenAIKey();
```

### 4. Input Validation

#### Gateway URL Validation

```typescript
export function validateGatewayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Block obviously malicious patterns
    if (parsed.hostname.includes('..') || parsed.hostname.includes('\x00')) {
      return false;
    }

    // In production, only allow HTTPS
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

#### User Input Sanitization

```typescript
export function sanitizeUserMessage(message: string): string {
  // Limit length
  const maxLength = 10000;
  if (message.length > maxLength) {
    message = message.slice(0, maxLength);
  }

  // Remove null bytes
  message = message.replace(/\x00/g, '');

  // Trim whitespace
  message = message.trim();

  return message;
}
```

### 5. Authentication & Authorization

#### Gateway Authentication

The Gateway should implement proper authentication:

```javascript
// Middleware to validate auth tokens
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  const token = authHeader.slice(7);

  // Validate token (check database, JWT, etc.)
  if (!isValidToken(token)) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  // Attach user to request
  req.user = getUserFromToken(token);
  next();
}

// Apply to protected routes
app.post('/agents/:agentId/sessions/:sessionId/realtime', requireAuth, async (req, res) => {
  // Only authenticated users can create sessions
  // ...
});
```

#### Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

// Limit API calls per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Stricter limits for expensive operations
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 voice sessions per minute
});

app.post('/agents/:agentId/sessions/:sessionId/realtime', voiceLimiter, async (req, res) => {
  // ...
});
```

### 6. Data Protection

#### Secure Storage

```typescript
import * as SecureStore from 'expo-secure-store';

// ✅ CORRECT: Sensitive data in encrypted storage
await SecureStore.setItemAsync('authToken', token);
await SecureStore.setItemAsync('gatewayUrl', gatewayUrl);

// ❌ WRONG: Sensitive data in AsyncStorage (not encrypted)
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('authToken', token); // DON'T DO THIS
```

#### HTTPS Only

```typescript
// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.protocol !== 'https') {
      return res.status(403).json({ error: 'HTTPS required' });
    }
    next();
  });
}
```

### 7. Logging & Monitoring

#### What to Log

```javascript
// ✅ Safe logging
console.log('User authenticated', { userId: user.id, timestamp: Date.now() });
console.log('Voice session created', { sessionId, agentId });

// ❌ NEVER log these
console.log('API key:', process.env.OPENAI_API_KEY); // NEVER
console.log('User token:', authToken); // NEVER
console.log('User message:', userMessage); // Careful - may contain PII
```

#### Error Tracking

```javascript
// Use structured error tracking (Sentry, Rollbar, etc.)
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Don't send sensitive data
  beforeSend(event) {
    // Scrub sensitive fields
    if (event.request?.headers?.authorization) {
      event.request.headers.authorization = '[REDACTED]';
    }
    return event;
  },
});
```

## Security Checklist

### Before Production Deployment

- [ ] All API keys removed from `.env` files
- [ ] `.env` in `.gitignore` (verify with `git check-ignore .env`)
- [ ] Gateway implements server-side ephemeral token generation
- [ ] HTTPS enforced for all production traffic
- [ ] Input validation on all user inputs
- [ ] Rate limiting configured
- [ ] Authentication/authorization implemented
- [ ] Secrets stored in secrets manager (AWS/GCP/Azure/Vault)
- [ ] Error tracking configured (Sentry/Rollbar)
- [ ] Logging audited (no sensitive data logged)
- [ ] CORS configured with specific origins
- [ ] Security headers configured (Helmet.js)
- [ ] Dependencies audited (`npm audit`)
- [ ] Code signing configured for iOS/Android
- [ ] App transport security configured (iOS)

### Regular Security Maintenance

- [ ] Rotate API keys quarterly
- [ ] Update dependencies monthly (`npm update`)
- [ ] Review access logs for suspicious activity
- [ ] Test authentication bypass attempts
- [ ] Penetration testing annually
- [ ] Review and update rate limits based on usage

## Incident Response

### If API Keys Are Exposed

1. **Immediately revoke** exposed keys at provider (OpenAI/Anthropic/ElevenLabs)
2. **Generate new keys** and update in secrets manager
3. **Check usage logs** for unauthorized access
4. **Notify users** if their data may be affected
5. **Review code** to prevent future exposures
6. **Update documentation** and training

### If User Data Is Compromised

1. **Isolate affected systems** immediately
2. **Assess scope** of data exposure
3. **Notify affected users** within 72 hours (GDPR requirement)
4. **Report to authorities** if required by law
5. **Document incident** and lessons learned
6. **Implement fixes** and re-test security

## Additional Resources

- [OWASP Mobile Security Testing Guide](https://owasp.org/www-project-mobile-security-testing-guide/)
- [OpenAI API Security Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [Expo Security Guidelines](https://docs.expo.dev/guides/security/)
- [React Native Security](https://reactnative.dev/docs/security)

## Contact

For security issues, please contact: [your-security-email@domain.com]
