// Main export file for services
export * from './types';
export * from './api';

// Service implementations
export { ConsoleLogger, createLogger } from './logger';
export { WebConfigService } from './config';
export { WebSocketService } from './websocket';
export { WebChatService } from './chat';

// Main service orchestrator
import type { Config, ConnectionState } from './types';
import { WebConfigService } from './config';
import { WebSocketService } from './websocket';
import { WebChatService } from './chat';
import { createLogger, type ConsoleLogger } from './logger';

export class WebotService {
  private configService: WebConfigService;
  private wsService: WebSocketService;
  private chatService: WebChatService;
  private logger: ConsoleLogger;

  constructor(options?: {
    initialGatewayUrl?: string;
    initialGatewayToken?: string;
    sessionKey?: string;
    chatContainerId?: string;
    messageInputId?: string;
    sendBtnId?: string;
  }) {
    // Create services
    this.logger = createLogger();
    this.configService = new WebConfigService(
      options?.initialGatewayUrl,
      options?.initialGatewayToken
    );

    this.wsService = new WebSocketService(
      this.configService,
      options?.sessionKey
    );

    this.chatService = new WebChatService(
      this.wsService,
      this.logger,
      options?.chatContainerId,
      options?.messageInputId,
      options?.sendBtnId
    );

    // Set up event handlers
    this.setupEventHandlers();
  }

  // Setup event handlers
  private setupEventHandlers(): void {
    // Handle connection status changes
    this.wsService.onConnect(() => {
      this.logger.log("[Webot] Connected to gateway");
      this.chatService.updateUIForConnection("connected");

      // Load chat history
      this.chatService.loadHistory().catch(err => {
        this.logger.error("[Webot] Failed to load history:", err);
      });
    });

    this.wsService.onDisconnect((error) => {
      this.logger.log("[Webot] Disconnected from gateway", error);
      this.chatService.updateUIForConnection("disconnected", error);
    });

    // Handle chat events
    this.wsService.onChatEvent((payload) => {
      this.logger.log("[Webot] Chat event received:", payload.state);

      if (payload.state === "final" && payload.message) {
        // Assistant response complete
        const content = payload.message.content
          .map((c: { type: string; text: string }) => c.text)
          .join("");
        this.logger.log(`[Webot] Assistant response: ${content.slice(0, 100)}...`);
        this.chatService.addMessage("assistant", content);
        this.chatService.hideLoading();
      } else if (payload.state === "error" && payload.errorMessage) {
        this.logger.log(`[Webot] Chat error: ${payload.errorMessage}`);
        this.chatService.hideLoading();
        this.chatService.addMessage("assistant", `Error: ${payload.errorMessage}`);
      }
    });
  }

  // Public API
  async initialize(): Promise<void> {
    this.logger.log("[Webot] Initializing...");

    // Load configuration
    try {
      await this.configService.loadFromServer();
      this.logger.log("[Webot] Configuration loaded");
    } catch (err) {
      this.logger.error("[Webot] Failed to load configuration:", err);
    }

    // Connect to gateway
    await this.wsService.connect();
  }

  // Send message
  async sendMessage(content: string): Promise<void> {
    await this.chatService.sendMessage();
  }

  // Load chat history
  async loadChatHistory(limit?: number): Promise<void> {
    await this.chatService.loadHistory(limit);
  }

  // Get connection state
  getConnectionState(): ConnectionState {
    return this.wsService.getConnectionState();
  }

  // Get configuration
  getConfig(): Config {
    return this.configService.getConfig();
  }

  // Update configuration
  updateConfig(config: Partial<Config>): void {
    this.configService.updateConfig(config);
  }

  // Get session key
  getSessionKey(): string {
    return this.wsService.getSessionKey();
  }

  // Set session key
  setSessionKey(sessionKey: string): void {
    this.wsService.setSessionKey(sessionKey);
  }

  // Disconnect
  disconnect(): void {
    this.wsService.disconnect();
  }

  // Reconnect
  async reconnect(): Promise<void> {
    await this.wsService.reconnect();
  }

  // Clear chat
  clearChat(): void {
    this.chatService.clear();
  }

  // Enable/disable debug logging
  setDebug(enabled: boolean): void {
    this.logger.setDebug(enabled);
  }
}

// Factory function for easy creation
export function createWebotService(options?: {
  initialGatewayUrl?: string;
  initialGatewayToken?: string;
  sessionKey?: string;
  chatContainerId?: string;
  messageInputId?: string;
  sendBtnId?: string;
}): WebotService {
  return new WebotService(options);
}