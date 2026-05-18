import {
  sanitizeUserMessage,
  validateAuthToken,
  validateGatewayUrl,
  validateId,
  validatePairingCode,
} from '../validation';

describe('validation utils', () => {
  describe('validateGatewayUrl', () => {
    it('accepts valid HTTP URLs', () => {
      const result = validateGatewayUrl('http://localhost:3333');
      expect(result.valid).toBe(true);
    });

    it('accepts valid HTTPS URLs', () => {
      const result = validateGatewayUrl('https://gateway.example.com');
      expect(result.valid).toBe(true);
    });

    it('rejects empty URLs', () => {
      const result = validateGatewayUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('rejects URLs that are too short', () => {
      const result = validateGatewayUrl('http://');
      expect(result.valid).toBe(false);
    });

    it('rejects non-HTTP(S) protocols', () => {
      const result = validateGatewayUrl('ftp://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTTP');
    });

    it('rejects malicious patterns', () => {
      const result = validateGatewayUrl('http://evil..com');
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeUserMessage', () => {
    it('trims whitespace', () => {
      const result = sanitizeUserMessage('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('removes null bytes', () => {
      const result = sanitizeUserMessage('hello\x00world');
      expect(result).toBe('helloworld');
    });

    it('truncates long messages', () => {
      const longMessage = 'a'.repeat(15000);
      const result = sanitizeUserMessage(longMessage);
      expect(result.length).toBeLessThanOrEqual(10000);
    });

    it('removes control characters except newlines', () => {
      const result = sanitizeUserMessage('hello\x01\x02world\ntest');
      expect(result).toBe('helloworld\ntest');
    });

    it('handles non-string input', () => {
      const result = sanitizeUserMessage(null as any);
      expect(result).toBe('');
    });
  });

  describe('validateId', () => {
    it('accepts valid alphanumeric IDs', () => {
      const result = validateId('agent-123', 'agent');
      expect(result.valid).toBe(true);
    });

    it('accepts IDs with underscores and hyphens', () => {
      const result = validateId('my_agent-123', 'agent');
      expect(result.valid).toBe(true);
    });

    it('rejects empty IDs', () => {
      const result = validateId('', 'agent');
      expect(result.valid).toBe(false);
    });

    it('rejects IDs that are too long', () => {
      const longId = 'a'.repeat(300);
      const result = validateId(longId, 'agent');
      expect(result.valid).toBe(false);
    });

    it('rejects IDs with special characters', () => {
      const result = validateId('agent@123', 'agent');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePairingCode', () => {
    it('accepts valid pairing codes', () => {
      const result = validatePairingCode('ABC-123-XYZ');
      expect(result.valid).toBe(true);
    });

    it('rejects empty codes', () => {
      const result = validatePairingCode('');
      expect(result.valid).toBe(false);
    });

    it('rejects codes that are too short', () => {
      const result = validatePairingCode('ABC');
      expect(result.valid).toBe(false);
    });

    it('rejects codes that are too long', () => {
      const longCode = 'a'.repeat(600);
      const result = validatePairingCode(longCode);
      expect(result.valid).toBe(false);
    });

    it('rejects codes with null bytes', () => {
      const result = validatePairingCode('ABC\x00123');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAuthToken', () => {
    it('accepts valid tokens', () => {
      const result = validateAuthToken('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result.valid).toBe(true);
    });

    it('rejects empty tokens', () => {
      const result = validateAuthToken('');
      expect(result.valid).toBe(false);
    });

    it('rejects tokens that are too short', () => {
      const result = validateAuthToken('abc');
      expect(result.valid).toBe(false);
    });

    it('rejects tokens that are too long', () => {
      const longToken = 'a'.repeat(3000);
      const result = validateAuthToken(longToken);
      expect(result.valid).toBe(false);
    });
  });
});
