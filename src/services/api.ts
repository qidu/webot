// API service interface
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

export type {
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
};

export interface WebSocketAPI {
  // Connection management
  connect(url: string): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;

  // Message sending
  send(frame: RequestFrame): void;
  sendWithResponse<T>(frame: RequestFrame): Promise<T | null>;

  // Gateway methods
  connectToGateway(params: ConnectParams): Promise<ResponseFrame>;
  sendChatMessage(params: ChatSendParams): Promise<ResponseFrame>;
  getChatHistory(params: ChatHistoryParams): Promise<ChatHistoryResponse | null>;

  // State management
  getConnectionState(): ConnectionState;
  updateStatus(status: ConnectionStatus, error?: string): void;

  // Event handling
  onConnect(callback: () => void): void;
  onDisconnect(callback: (error?: string) => void): void;
  onEvent(callback: (event: EventFrame) => void): void;
  onChatEvent(callback: (payload: ChatEventPayload) => void): void;

  // Configuration
  loadConfig(): Promise<Config>;
  updateConfig(config: Partial<Config>): void;

  // Session management
  getSessionKey(): string;
  setSessionKey(sessionKey: string): void;
}

export interface ConfigService {
  getGatewayUrl(): string;
  getGatewayToken(): string;
  setGatewayUrl(url: string): void;
  setGatewayToken(token: string): void;
  loadFromServer(): Promise<Config>;
  saveToLocalStorage(): void;
  loadFromLocalStorage(): Config | null;
  getConfig(): Config;
  updateConfig(config: Partial<Config>): void;
}

export interface ChatService {
  sendMessage(content: string): Promise<void>;
  loadHistory(limit?: number): Promise<void>;
  addMessage(role: string, content: string, scroll?: boolean): void;
  showLoading(): void;
  hideLoading(): void;
  clear(): void;
}

export interface Logger {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  setDebug(enabled: boolean): void;
}