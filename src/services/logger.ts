// Logger service implementation
import type { Logger } from './api';

export class ConsoleLogger implements Logger {
  private debugEnabled = false;

  constructor(initialDebug = false) {
    this.debugEnabled = initialDebug;
  }

  log(...args: unknown[]): void {
    console.log('[INFO]', new Date().toISOString(), ...args);
  }

  error(...args: unknown[]): void {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  }

  debug(...args: unknown[]): void {
    if (this.debugEnabled) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  isDebugEnabled(): boolean {
    return this.debugEnabled;
  }
}

// Factory function to create logger with debug detection
export function createLogger(): ConsoleLogger {
  const debug = detectDebug();
  return new ConsoleLogger(debug);
}

function detectDebug(): boolean {
  // Check process environment
  if (typeof process !== 'undefined' && process.env?.DEBUG === "true") {
    return true;
  }

  // Check URL parameter
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "true") {
      return true;
    }

    // Check localStorage
    if (localStorage.getItem("debug") === "true") {
      return true;
    }
  }

  return false;
}