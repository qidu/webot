# Webot Service API Documentation

## Overview

The Webot service provides a client-side SDK for connecting to the Clawdbot gateway via WebSocket and managing chat interactions. The architecture is modular with clear separation of concerns.

## Installation

```bash
npm install webot
```

## Core Types

### Protocol Types (`src/services/types.ts`)

```typescript
// Request/Response frames
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

// Connection parameters
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

// Chat-related types
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

// Configuration and connection state
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
```

## Service Interfaces (`src/services/api.ts`)

### WebSocketAPI Interface

```typescript
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
```

### ConfigService Interface

```typescript
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
```

### ChatService Interface

```typescript
export interface ChatService {
  sendMessage(content: string): Promise<void>;
  loadHistory(limit?: number): Promise<void>;
  addMessage(role: string, content: string, scroll?: boolean): void;
  showLoading(): void;
  hideLoading(): void;
  clear(): void;
}
```

### Logger Interface

```typescript
export interface Logger {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  setDebug(enabled: boolean): void;
}
```

## Service Implementations

### ConsoleLogger (`src/services/logger.ts`)

A simple console-based logger with debug mode support.

```typescript
import { ConsoleLogger, createLogger } from 'webot';

// Create logger with automatic debug detection
const logger = createLogger();

// Or create with explicit debug mode
const debugLogger = new ConsoleLogger(true);

logger.log("Info message");
logger.error("Error message");
logger.debug("Debug message (only shown when debug enabled)");
logger.setDebug(true); // Enable debug mode
```

### WebConfigService (`src/services/config.ts`)

Manages gateway configuration with server and localStorage persistence.

```typescript
import { WebConfigService } from 'webot';

const configService = new WebConfigService(
  "ws://127.0.0.1:18789", // default URL
  "" // default token
);

// Load configuration from server
await configService.loadFromServer();

// Save/load from localStorage
configService.saveToLocalStorage();
const localConfig = configService.loadFromLocalStorage();

// Update configuration
configService.updateConfig({
  gatewayUrl: "ws://new-gateway.example.com",
  gatewayToken: "new-token"
});
```

### WebSocketService (`src/services/websocket.ts`)

Handles WebSocket communication with the gateway.

```typescript
import { WebSocketService } from 'webot';
import { WebConfigService } from 'webot';

const configService = new WebConfigService();
const wsService = new WebSocketService(configService, "session-key-123");

// Connect to gateway
await wsService.connect();

// Send chat message
await wsService.sendChatMessage({
  sessionKey: "session-key-123",
  message: "Hello, world!",
  idempotencyKey: "unique-id"
});

// Get chat history
const history = await wsService.getChatHistory({
  sessionKey: "session-key-123",
  limit: 50
});

// Event handling
wsService.onConnect(() => {
  console.log("Connected to gateway");
});

wsService.onChatEvent((payload) => {
  console.log("Chat event:", payload.state, payload.message);
});

// Connection state
const state = wsService.getConnectionState();
console.log("Connection status:", state.status);
```

### WebChatService (`src/services/chat.ts`)

Manages chat UI and user interactions.

```typescript
import { WebChatService } from 'webot';
import { WebSocketService } from 'webot';
import { ConsoleLogger } from 'webot';

const logger = new ConsoleLogger();
const wsService = new WebSocketService(configService, "session-key");
const chatService = new WebChatService(
  wsService,
  logger,
  "chat-container", // DOM element ID
  "message-input",  // DOM element ID
  "send-btn"        // DOM element ID
);

// Send message
await chatService.sendMessage("Hello, assistant!");

// Load history
await chatService.loadHistory(50);

// Add message programmatically
chatService.addMessage("user", "Hello from code!");

// Clear chat
chatService.clear();
```

## Main Service Orchestrator

### WebotService (`src/services/index.ts`)

The main orchestrator that ties all services together.

```typescript
import { WebotService, createWebotService } from 'webot';

// Using factory function
const webot = createWebotService({
  initialGatewayUrl: "ws://127.0.0.1:18789",
  initialGatewayToken: "your-token",
  sessionKey: "custom-session-key",
  chatContainerId: "chat-container",
  messageInputId: "message-input",
  sendBtnId: "send-btn"
});

// Or using constructor
const webot2 = new WebotService({
  initialGatewayUrl: "ws://127.0.0.1:18789",
  // ... other options
});

// Initialize and connect
await webot.initialize();

// Send message
await webot.sendMessage("Hello, world!");

// Get connection state
const state = webot.getConnectionState();

// Update configuration
webot.updateConfig({
  gatewayUrl: "ws://new-gateway.example.com"
});

// Load chat history
await webot.loadChatHistory(100);

// Disconnect
webot.disconnect();

// Reconnect
await webot.reconnect();

// Clear chat
webot.clearChat();

// Enable debug logging
webot.setDebug(true);
```

## Public API Methods

### WebotService Public Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `initialize()` | Loads configuration and connects to gateway | `Promise<void>` |
| `sendMessage(content: string)` | Sends a chat message | `Promise<void>` |
| `loadChatHistory(limit?: number)` | Loads chat history | `Promise<void>` |
| `getConnectionState()` | Gets current connection state | `ConnectionState` |
| `getConfig()` | Gets current configuration | `Config` |
| `updateConfig(config: Partial<Config>)` | Updates configuration | `void` |
| `getSessionKey()` | Gets current session key | `string` |
| `setSessionKey(sessionKey: string)` | Sets session key | `void` |
| `disconnect()` | Disconnects from gateway | `void` |
| `reconnect()` | Reconnects to gateway | `Promise<void>` |
| `clearChat()` | Clears chat UI | `void` |
| `setDebug(enabled: boolean)` | Enables/disables debug logging | `void` |

### Factory Function

```typescript
export function createWebotService(options?: {
  initialGatewayUrl?: string;
  initialGatewayToken?: string;
  sessionKey?: string;
  chatContainerId?: string;
  messageInputId?: string;
  sendBtnId?: string;
}): WebotService
```

## Usage Examples

### Basic Usage

```typescript
import { createWebotService } from 'webot';

// Create service
const webot = createWebotService({
  initialGatewayUrl: "ws://localhost:18789",
  chatContainerId: "chat",
  messageInputId: "input",
  sendBtnId: "send"
});

// Initialize
await webot.initialize();

// Send message
await webot.sendMessage("Hello!");
```

### Custom Integration

```typescript
import {
  WebConfigService,
  WebSocketService,
  WebChatService,
  ConsoleLogger
} from 'webot';

// Build custom service stack
const logger = new ConsoleLogger(true);
const config = new WebConfigService("ws://gateway.example.com");
const ws = new WebSocketService(config, "my-session");
const chat = new WebChatService(ws, logger, "chat", "input", "send");

// Connect
await ws.connect();

// Send message
await chat.sendMessage("Custom integration works!");
```

### Event Handling

```typescript
const webot = createWebotService();

// Listen to internal events via WebSocketService
const wsService = webot.wsService; // Access internal service

wsService.onConnect(() => {
  console.log("Gateway connected!");
});

wsService.onChatEvent((payload) => {
  if (payload.state === "final" && payload.message) {
    console.log("Assistant response:", payload.message.content);
  }
});
```

## DOM Requirements

The chat service requires specific DOM elements to be present:

```html
<!-- Required structure -->
<div id="chat-container" class="chat-container"></div>
<textarea id="message-input" placeholder="Type your message..."></textarea>
<button id="send-btn">Send</button>
```

You can customize the IDs by passing different values to the constructor.

## Configuration Sources

The configuration service loads from multiple sources in order:

1. **Server API**: `/api/config` endpoint
2. **LocalStorage**: `webot_gateway_url` and `webot_gateway_token`
3. **Constructor defaults**: Provided during service creation

## Debug Mode

Debug mode can be enabled in multiple ways:

1. **Environment variable**: `DEBUG=true`
2. **URL parameter**: `?debug=true`
3. **LocalStorage**: `localStorage.setItem("debug", "true")`
4. **Programmatically**: `webot.setDebug(true)`

## Error Handling

All services include comprehensive error logging. Errors are logged to console but don't crash the application. Network errors trigger automatic reconnection attempts.

## Browser Compatibility

Requires modern browser features:
- WebSocket API
- ES6+ features (Promises, async/await)
- `crypto.randomUUID()` (for session keys)

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## TypeScript Support

Full TypeScript definitions are included. Import types as needed:

```typescript
import type {
  Config,
  ConnectionState,
  ChatEventPayload,
  RequestFrame,
  ResponseFrame
} from 'webot';
```

## License

ISC License