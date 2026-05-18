/**
 * Structured logging utility with security-aware filtering
 *
 * Features:
 * - Structured JSON logging for easy parsing
 * - Log levels (debug, info, warn, error)
 * - Automatic PII/sensitive data filtering
 * - Production-safe (no sensitive data logged)
 * - Easy integration with monitoring services (Sentry, Datadog, etc.)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  // Sensitive field patterns to filter out
  private sensitivePatterns = [
    /api[_-]?key/i,
    /auth[_-]?token/i,
    /password/i,
    /secret/i,
    /bearer/i,
    /authorization/i,
    /private[_-]?key/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /session[_-]?token/i,
    /credit[_-]?card/i,
    /ssn/i,
    /social[_-]?security/i,
  ];

  constructor() {
    this.isDevelopment = __DEV__;

    // In production, only log warnings and errors
    this.minLevel = this.isDevelopment ? 'debug' : 'warn';
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.minLevel);
    const requestedIndex = levels.indexOf(level);
    return requestedIndex >= currentIndex;
  }

  /**
   * Filter sensitive data from context
   */
  private filterSensitive(context: LogContext): LogContext {
    const filtered: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      // Check if key matches sensitive patterns
      const isSensitive = this.sensitivePatterns.some((pattern) =>
        pattern.test(key),
      );

      if (isSensitive) {
        filtered[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively filter nested objects
        filtered[key] = Array.isArray(value)
          ? value.map((item) =>
              typeof item === 'object' && item !== null
                ? this.filterSensitive(item as LogContext)
                : item,
            )
          : this.filterSensitive(value as LogContext);
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Format log entry
   */
  private format(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      entry.context = this.filterSensitive(context);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    return entry;
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const logFn =
      entry.level === 'error'
        ? console.error
        : entry.level === 'warn'
          ? console.warn
          : console.log;

    if (this.isDevelopment) {
      // Pretty print in development
      logFn(
        `[${entry.level.toUpperCase()}] ${entry.message}`,
        entry.context || '',
        entry.error || '',
      );
    } else {
      // JSON format in production for log aggregation
      logFn(JSON.stringify(entry));
    }

    // TODO: Send to monitoring service (Sentry, Datadog, etc.)
    // if (entry.level === 'error' && entry.error) {
    //   Sentry.captureException(entry.error);
    // }
  }

  /**
   * Debug log (development only)
   */
  debug(message: string, context?: LogContext): void {
    this.output(this.format('debug', message, context));
  }

  /**
   * Info log
   */
  info(message: string, context?: LogContext): void {
    this.output(this.format('info', message, context));
  }

  /**
   * Warning log
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.output(this.format('warn', message, context, error));
  }

  /**
   * Error log
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.output(this.format('error', message, context, error));
  }

  /**
   * Log network request
   */
  request(
    method: string,
    url: string,
    context?: { duration?: number; status?: number },
  ): void {
    // Redact sensitive parts of URL (query params, tokens)
    let safeUrl = url;
    try {
      const parsed = new URL(url);
      // Clear query params that might contain tokens
      const sensitiveParams = ['token', 'key', 'auth', 'secret', 'session'];
      for (const param of sensitiveParams) {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }
      safeUrl = parsed.toString();
    } catch {
      // If URL parsing fails, just log the message
    }

    this.debug('API request', {
      method,
      url: safeUrl,
      ...context,
    });
  }

  /**
   * Log voice session event
   */
  voice(event: string, context?: LogContext): void {
    this.info(`Voice: ${event}`, context);
  }

  /**
   * Log user action
   */
  action(action: string, context?: LogContext): void {
    this.info(`Action: ${action}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };
