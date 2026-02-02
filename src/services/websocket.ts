// WebSocket service implementation
import type { WebSocketAPI, ConfigService } from './api';
import type {
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ConnectParams,
  ChatSendParams,
  ChatHistoryParams,
  ChatHistoryResponse,
  ChatEventPayload,
  Config,
  ConnectionState,
  ConnectionStatus
} from './types';
import { createLogger, type ConsoleLogger } from './logger';

export class WebSocketService implements WebSocketAPI {
  private ws: WebSocket | null = null;
  private connected = false;
  private sessionKey: string;
  private configService: ConfigService;
  private logger: ConsoleLogger;

  private connectionState: ConnectionState = {
    status: "disconnected"
  };

  private connectCallbacks: Array<() => void> = [];
  private disconnectCallbacks: Array<(error?: string) => void> = [];
  private eventCallbacks: Array<(event: EventFrame) => void> = [];
  private chatEventCallbacks: Array<(payload: ChatEventPayload) => void> = [];

  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(configService: ConfigService, initialSessionKey?: string) {
    this.configService = configService;
    this.sessionKey = initialSessionKey || `webchat-${crypto.randomUUID().slice(0, 8)}`;
    this.logger = createLogger();
  }

  // Connection management
  async connect(url?: string): Promise<void> {
    const gatewayUrl = url || this.configService.getGatewayUrl();
    this.updateStatus("connecting");

    this.logger.log(`Connecting to gateway: ${gatewayUrl}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(gatewayUrl);

        this.ws.onopen = () => {
          this.logger.log("[WebSocket] Connected, waiting for challenge...");
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.connected = false;
          this.updateStatus("disconnected", `Disconnected (code: ${event.code})`);
          this.logger.log(`[WebSocket] Closed: code=${event.code}, reason=${event.reason}`);

          // Notify disconnect callbacks
          this.disconnectCallbacks.forEach(callback => callback(event.reason));

          // Reconnect after 3 seconds
          this.logger.log("[WebSocket] Reconnecting in 3 seconds...");
          setTimeout(() => this.reconnect(), 3000);
        };

        this.ws.onerror = (error) => {
          this.logger.error("[WebSocket] Error:", error);
          this.updateStatus("disconnected", "Connection error");
          reject(error);
        };
      } catch (err) {
        this.logger.error("[WebSocket] Failed to create connection:", err);
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.updateStatus("disconnected", "Manually disconnected");

    // Clear all pending requests
    this.pendingRequests.forEach((request, id) => {
      clearTimeout(request.timeout);
      request.reject(new Error("Connection closed"));
    });
    this.pendingRequests.clear();
  }

  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }

  // Message handling
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      this.logger.log(`[WebSocket] Received: type=${data.type}, event=${data.event || "N/A"}, id=${data.id || "N/A"}`);

      // Handle connect challenge
      if (data.type === "event" && data.event === "connect.challenge") {
        this.sendConnect();
        return;
      }

      // Handle response frames
      if (data.type === "res") {
        const response = data as unknown as ResponseFrame;
        this.handleResponse(response);
        return;
      }

      // Handle event frames
      if (data.type === "event") {
        const eventFrame = data as unknown as EventFrame;
        this.handleEvent(eventFrame);
        return;
      }
    } catch (err) {
      this.logger.error("[WebSocket] Parse error:", err);
    }
  }

  private handleResponse(response: ResponseFrame): void {
    this.logger.log("[Response]", response.id, response.ok ? "OK" : "ERROR");

    // Resolve pending request
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      if (response.ok) {
        pending.resolve(response.payload);
      } else {
        pending.reject(new Error(response.error?.message || "Request failed"));
      }
      this.pendingRequests.delete(response.id);
    }

    // Handle successful connection
    if (response.ok && response.payload && typeof response.payload === "object") {
      const payload = response.payload as { type?: string };

      if (payload.type === "hello-ok") {
        this.connected = true;
        this.updateStatus("connected", "Connected");
        this.connectionState.lastConnectedAt = new Date();

        // Notify connect callbacks
        this.connectCallbacks.forEach(callback => callback());
      }
    }
  }

  private handleEvent(event: EventFrame): void {
    this.logger.log("[Event]", event.event, `seq=${event.seq || "N/A"}`);

    // Notify event callbacks
    this.eventCallbacks.forEach(callback => callback(event));

    // Handle chat events
    if (event.event === "chat") {
      const payload = event.payload as ChatEventPayload;
      this.handleChatEvent(payload);
    }
  }

  private handleChatEvent(payload: ChatEventPayload): void {
    this.logger.log("[Chat Event]", `session=${payload.sessionKey}`, `run=${payload.runId}`, `state=${payload.state}`);

    // Notify chat event callbacks
    this.chatEventCallbacks.forEach(callback => callback(payload));
  }

  // Message sending
  send(frame: RequestFrame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
      this.logger.log(`[WebSocket] Sent: ${frame.method} (${frame.id})`);
    } else {
      this.logger.error("[WebSocket] Cannot send, not connected");
    }
  }

  async sendWithResponse<T>(frame: RequestFrame): Promise<T | null> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.logger.error("[WebSocket] Cannot send, not connected");
        resolve(null);
        return;
      }

      this.logger.log(`[WebSocket] Sending request: ${frame.method} (${frame.id})`);

      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "res" && data.id === frame.id) {
            this.logger.log(`[WebSocket] Received response: ${frame.method} (${frame.id}) ok=${data.ok}`);
            this.ws?.removeEventListener("message", handler);
            resolve(data.ok ? (data.payload as T) : null);
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.addEventListener("message", handler);
      this.ws.send(JSON.stringify(frame));

      // Timeout after 10 seconds
      setTimeout(() => {
        this.ws?.removeEventListener("message", handler);
        this.logger.log(`[WebSocket] Request timeout: ${frame.method} (${frame.id})`);
        resolve(null);
      }, 10000);
    });
  }

  // Gateway methods
  async connectToGateway(params: ConnectParams): Promise<ResponseFrame> {
    const frame: RequestFrame = {
      type: "req",
      id: crypto.randomUUID(),
      method: "connect",
      params,
    };

    this.send(frame);

    // Wait for response
    const response = await this.sendWithResponse<unknown>(frame);
    return {
      type: "res",
      id: frame.id,
      ok: !!response,
      payload: response || undefined
    };
  }

  async sendChatMessage(params: ChatSendParams): Promise<ResponseFrame> {
    const frame: RequestFrame = {
      type: "req",
      id: crypto.randomUUID(),
      method: "chat.send",
      params,
    };

    this.send(frame);

    // Wait for response
    const response = await this.sendWithResponse<unknown>(frame);
    return {
      type: "res",
      id: frame.id,
      ok: !!response,
      payload: response || undefined
    };
  }

  async getChatHistory(params: ChatHistoryParams): Promise<ChatHistoryResponse | null> {
    const frame: RequestFrame = {
      type: "req",
      id: crypto.randomUUID(),
      method: "chat.history",
      params,
    };

    return await this.sendWithResponse<ChatHistoryResponse>(frame);
  }

  // State management
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  updateStatus(status: ConnectionStatus, error?: string): void {
    this.connectionState.status = status;

    if (error) {
      this.connectionState.lastError = error;
    }

    if (status === "disconnected") {
      this.connectionState.disconnectedAt = new Date();
    }

    this.logger.log(`[Status] ${status}${error ? `: ${error}` : ''}`);
  }

  // Event handling
  onConnect(callback: () => void): void {
    this.connectCallbacks.push(callback);
  }

  onDisconnect(callback: (error?: string) => void): void {
    this.disconnectCallbacks.push(callback);
  }

  onEvent(callback: (event: EventFrame) => void): void {
    this.eventCallbacks.push(callback);
  }

  onChatEvent(callback: (payload: ChatEventPayload) => void): void {
    this.chatEventCallbacks.push(callback);
  }

  // Configuration
  async loadConfig(): Promise<Config> {
    return await this.configService.loadFromServer();
  }

  updateConfig(config: Partial<Config>): void {
    this.configService.updateConfig(config);
  }

  // Session management
  getSessionKey(): string {
    return this.sessionKey;
  }

  setSessionKey(sessionKey: string): void {
    this.sessionKey = sessionKey;
    this.logger.log(`[Session] Key updated: ${sessionKey}`);
  }

  // Private helper methods
  private sendConnect(): void {
    const params: ConnectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "webchat",
        displayName: "Webot",
        version: "1.0.0",
        platform: "web",
        mode: "webchat",
      },
      auth: {
        token: this.configService.getGatewayToken() || undefined,
      },
      role: "operator",
      scopes: ["operator.admin"],
    };

    const frame: RequestFrame = {
      type: "req",
      id: crypto.randomUUID(),
      method: "connect",
      params,
    };

    this.send(frame);
  }

  // Public utility methods
  isConnected(): boolean {
    return this.connected;
  }

  getWebSocket(): WebSocket | null {
    return this.ws;
  }
}