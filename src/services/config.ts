// Configuration service implementation
import type { ConfigService } from './api';
import type { Config } from './types';
import { createLogger, type ConsoleLogger } from './logger';

export class WebConfigService implements ConfigService {
  private gatewayUrl: string;
  private gatewayToken: string;
  private logger: ConsoleLogger;

  constructor(initialUrl = "ws://127.0.0.1:18789", initialToken = "") {
    this.gatewayUrl = initialUrl;
    this.gatewayToken = initialToken;
    this.logger = createLogger();
  }

  getGatewayUrl(): string {
    return this.gatewayUrl;
  }

  getGatewayToken(): string {
    return this.gatewayToken;
  }

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
    this.logger.log(`[Config] Gateway URL updated: ${url}`);
  }

  setGatewayToken(token: string): void {
    this.gatewayToken = token;
    this.logger.log(`[Config] Gateway token updated (length: ${token.length})`);
  }

  async loadFromServer(): Promise<Config> {
    this.logger.log("[Config] Loading from server...");

    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const config = await res.json();

      if (config.gatewayUrl) {
        this.gatewayUrl = config.gatewayUrl;
      }

      if (config.gatewayToken) {
        this.gatewayToken = config.gatewayToken;
      }

      this.logger.log("[Config] Loaded from server:", {
        gatewayUrl: this.gatewayUrl,
        hasToken: !!this.gatewayToken
      });

      return {
        gatewayUrl: this.gatewayUrl,
        gatewayToken: this.gatewayToken
      };
    } catch (err) {
      this.logger.error("[Config] Failed to load from server:", err);
      this.logger.log("[Config] Using default configuration");

      return {
        gatewayUrl: this.gatewayUrl,
        gatewayToken: this.gatewayToken
      };
    }
  }

  saveToLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('webot_gateway_url', this.gatewayUrl);
      localStorage.setItem('webot_gateway_token', this.gatewayToken);
      this.logger.log("[Config] Saved to localStorage");
    } catch (err) {
      this.logger.error("[Config] Failed to save to localStorage:", err);
    }
  }

  loadFromLocalStorage(): Config | null {
    if (typeof window === 'undefined') return null;

    try {
      const url = localStorage.getItem('webot_gateway_url');
      const token = localStorage.getItem('webot_gateway_token');

      if (!url && !token) {
        return null;
      }

      if (url) {
        this.gatewayUrl = url;
      }

      if (token) {
        this.gatewayToken = token;
      }

      this.logger.log("[Config] Loaded from localStorage:", {
        gatewayUrl: this.gatewayUrl,
        hasToken: !!this.gatewayToken
      });

      return {
        gatewayUrl: this.gatewayUrl,
        gatewayToken: this.gatewayToken
      };
    } catch (err) {
      this.logger.error("[Config] Failed to load from localStorage:", err);
      return null;
    }
  }

  getConfig(): Config {
    return {
      gatewayUrl: this.gatewayUrl,
      gatewayToken: this.gatewayToken
    };
  }

  updateConfig(config: Partial<Config>): void {
    if (config.gatewayUrl !== undefined) {
      this.gatewayUrl = config.gatewayUrl;
    }

    if (config.gatewayToken !== undefined) {
      this.gatewayToken = config.gatewayToken;
    }

    this.logger.log("[Config] Updated:", this.getConfig());
  }
}