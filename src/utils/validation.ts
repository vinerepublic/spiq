/**
 * Input validation utilities for security and data integrity
 */

/**
 * Validates a Gateway URL for security and correctness
 */
export function validateGatewayUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  // Check if empty
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Gateway URL is required' };
  }

  // Trim whitespace
  url = url.trim();

  // Check minimum length
  if (url.length < 10) {
    return { valid: false, error: 'Gateway URL is too short' };
  }

  // Check maximum length (prevent DoS)
  if (url.length > 2048) {
    return { valid: false, error: 'Gateway URL is too long' };
  }

  // Try to parse as URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      valid: false,
      error: 'Only HTTP and HTTPS protocols are supported',
    };
  }

  // In production, require HTTPS
  if (
    process.env.NODE_ENV === 'production' &&
    parsed.protocol !== 'https:'
  ) {
    return {
      valid: false,
      error: 'HTTPS is required in production',
    };
  }

  // Block obviously malicious patterns
  if (
    parsed.hostname.includes('..') ||
    parsed.hostname.includes('\x00') ||
    parsed.hostname.includes('\n') ||
    parsed.hostname.includes('\r')
  ) {
    return { valid: false, error: 'Invalid hostname' };
  }

  // Block localhost/127.0.0.1 in production
  if (process.env.NODE_ENV === 'production') {
    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1' ||
      parsed.hostname.endsWith('.local');

    if (isLocalhost) {
      return {
        valid: false,
        error: 'Localhost URLs are not allowed in production',
      };
    }
  }

  return { valid: true };
}

/**
 * Sanitizes user message text to prevent injection and limit size
 */
export function sanitizeUserMessage(message: string): string {
  if (typeof message !== 'string') {
    return '';
  }

  // Limit length to prevent DoS
  const maxLength = 10000;
  if (message.length > maxLength) {
    message = message.slice(0, maxLength);
  }

  // Remove null bytes
  message = message.replace(/\x00/g, '');

  // Remove other control characters except newlines and tabs
  message = message.replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  message = message.trim();

  return message;
}

/**
 * Validates session/agent ID format
 */
export function validateId(
  id: string,
  type: 'agent' | 'session' | 'conference' = 'session',
): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: `${type} ID is required` };
  }

  // Trim whitespace
  id = id.trim();

  // Check length
  if (id.length < 1) {
    return { valid: false, error: `${type} ID cannot be empty` };
  }

  if (id.length > 256) {
    return { valid: false, error: `${type} ID is too long` };
  }

  // Only allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return {
      valid: false,
      error: `${type} ID contains invalid characters`,
    };
  }

  return { valid: true };
}

/**
 * Validates pairing code/token format
 */
export function validatePairingCode(code: string): {
  valid: boolean;
  error?: string;
} {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Pairing code is required' };
  }

  // Trim whitespace
  code = code.trim();

  // Check length
  if (code.length < 4) {
    return { valid: false, error: 'Pairing code is too short' };
  }

  if (code.length > 512) {
    return { valid: false, error: 'Pairing code is too long' };
  }

  // Check for suspicious patterns
  if (code.includes('\x00') || code.includes('\n') || code.includes('\r')) {
    return { valid: false, error: 'Pairing code contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validates auth token format
 */
export function validateAuthToken(token: string): {
  valid: boolean;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Auth token is required' };
  }

  // Trim whitespace
  token = token.trim();

  // Check length
  if (token.length < 10) {
    return { valid: false, error: 'Auth token is too short' };
  }

  if (token.length > 2048) {
    return { valid: false, error: 'Auth token is too long' };
  }

  // Check for suspicious patterns
  if (token.includes('\x00') || token.includes('\n') || token.includes('\r')) {
    return { valid: false, error: 'Auth token contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Sanitizes agent name for display
 */
export function sanitizeAgentName(name: string): string {
  if (typeof name !== 'string') {
    return 'Unknown Agent';
  }

  // Limit length
  const maxLength = 100;
  if (name.length > maxLength) {
    name = name.slice(0, maxLength);
  }

  // Remove control characters
  name = name.replace(/[\x00-\x1F\x7F]/g, '');

  // Trim whitespace
  name = name.trim();

  // Default if empty
  if (name.length === 0) {
    return 'Unknown Agent';
  }

  return name;
}

/**
 * Validates voice transport type
 */
export function validateVoiceTransport(
  transport: string,
): transport is 'openai-realtime' | 'livekit' | 'legacy' {
  return ['openai-realtime', 'livekit', 'legacy'].includes(transport);
}

/**
 * Rate limiting helper - simple in-memory implementation
 * For production, use Redis or similar distributed cache
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  /**
   * Check if a request is allowed for the given key
   * @param key - Unique identifier (user ID, IP, etc.)
   * @returns true if request is allowed, false if rate limited
   */
  checkLimit(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this key
    let keyRequests = this.requests.get(key) || [];

    // Filter out requests outside the window
    keyRequests = keyRequests.filter((timestamp) => timestamp > windowStart);

    // Check if under limit
    if (keyRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    keyRequests.push(now);
    this.requests.set(key, keyRequests);

    return true;
  }

  /**
   * Clean up old entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter((ts) => ts > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}
