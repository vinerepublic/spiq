import { Logger } from '../logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('sensitive data filtering', () => {
    it('redacts API keys from context', () => {
      logger.info('Test message', { api_key: 'secret-key-123' });

      const loggedData = consoleSpy.mock.calls[0];
      expect(JSON.stringify(loggedData)).not.toContain('secret-key-123');
      expect(JSON.stringify(loggedData)).toContain('[REDACTED]');
    });

    it('redacts auth tokens from context', () => {
      logger.info('Test message', { auth_token: 'Bearer abc123' });

      const loggedData = consoleSpy.mock.calls[0];
      expect(JSON.stringify(loggedData)).not.toContain('abc123');
      expect(JSON.stringify(loggedData)).toContain('[REDACTED]');
    });

    it('redacts passwords from context', () => {
      logger.info('Test message', { password: 'my-secret-password' });

      const loggedData = consoleSpy.mock.calls[0];
      expect(JSON.stringify(loggedData)).not.toContain('my-secret-password');
      expect(JSON.stringify(loggedData)).toContain('[REDACTED]');
    });

    it('preserves non-sensitive data', () => {
      logger.info('Test message', { userId: '123', action: 'login' });

      const loggedData = consoleSpy.mock.calls[0];
      expect(JSON.stringify(loggedData)).toContain('123');
      expect(JSON.stringify(loggedData)).toContain('login');
    });

    it('recursively filters nested objects', () => {
      logger.info('Test message', {
        user: {
          id: '123',
          password: 'secret',
        },
      });

      const loggedData = consoleSpy.mock.calls[0];
      expect(JSON.stringify(loggedData)).toContain('123');
      expect(JSON.stringify(loggedData)).not.toContain('secret');
      expect(JSON.stringify(loggedData)).toContain('[REDACTED]');
    });
  });

  describe('log levels', () => {
    it('logs debug messages in development', () => {
      logger.debug('Debug message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('logs info messages', () => {
      logger.info('Info message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('logs warning messages', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      logger.warn('Warning message');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('logs error messages', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.error('Error message');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('URL sanitization', () => {
    it('redacts sensitive query parameters', () => {
      logger.request('GET', 'https://api.example.com/endpoint?token=secret123');

      const loggedData = consoleSpy.mock.calls[0];
      expect(JSON.stringify(loggedData)).not.toContain('secret123');
      expect(JSON.stringify(loggedData)).toContain('[REDACTED]');
    });

    it('preserves non-sensitive query parameters', () => {
      logger.request('GET', 'https://api.example.com/endpoint?page=1&limit=10');

      const loggedData = consoleSpy.mock.calls[0];
      expect(JSON.stringify(loggedData)).toContain('page=1');
      expect(JSON.stringify(loggedData)).toContain('limit=10');
    });
  });
});
