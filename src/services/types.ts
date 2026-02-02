// Protocol types for WebSocket communication
export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface EventFrame {
  type: "event";
  event: string;
  seq?: number;
  payload?: unknown;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
  };
  auth?: {
    token?: string;
    password?: string;
  };
  role?: string;
  scopes?: string[];
}

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "started" | "streaming" | "final" | "error";
  message?: {
    role: string;
    content: Array<{ type: string; text: string }>;
    timestamp: number;
    stopReason?: string;
  };
  errorMessage?: string;
}

export interface ChatHistoryResponse {
  sessionKey: string;
  sessionId: string;
  messages: Array<{
    type: string;
    id: string;
    timestamp: string;
    message: {
      role: string;
      content: Array<{ type: string; text: string }>;
      timestamp: number;
      stopReason?: string;
    };
  }>;
}

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  idempotencyKey: string;
}

export interface ChatHistoryParams {
  sessionKey: string;
  limit?: number;
  before?: string;
  after?: string;
}

export interface Config {
  gatewayUrl: string;
  gatewayToken: string;
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface ConnectionState {
  status: ConnectionStatus;
  lastError?: string;
  lastConnectedAt?: Date;
  disconnectedAt?: Date;
}