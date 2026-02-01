// Webot - Clawdbot WebChat Client Frontend
// Connects to gateway at ws://127.0.0.1:18789 with token auth

// DEBUG LOG: Enable verbose logging (set ?debug=true in URL or localStorage)
function isDebugEnabled() {
  if (typeof process !== 'undefined' && process.env?.DEBUG === "true") return true;
  if (new URLSearchParams(window.location.search).get("debug") === "true") return true;
  if (localStorage.getItem("debug") === "true") return true;
  return false;
}
const DEBUG = isDebugEnabled();

function log(...args: unknown[]) {
  if (DEBUG) console.log("[DEBUG]", new Date().toISOString(), ...args);
}

function logError(...args: unknown[]) {
  console.error("[ERROR]", new Date().toISOString(), ...args);
}

// Protocol types
interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface EventFrame {
  type: "event";
  event: string;
  seq?: number;
  payload?: unknown;
}

interface ConnectParams {
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

interface ChatEventPayload {
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

interface ChatHistoryResponse {
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

// Configuration - these can be overridden by the server
let gatewayUrl = "ws://127.0.0.1:18789";
let gatewayToken = "";

// State
let ws: WebSocket | null = null;
let connected = false;
let sessionKey = `webchat-${crypto.randomUUID().slice(0, 8)}`;

// DOM elements
const chatContainer = document.getElementById("chat-container")!;
const messageInput = document.getElementById("message-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const statusDot = document.getElementById("status-dot")!;
const statusText = document.getElementById("status-text")!;

// Load config from server if available
async function loadConfig() {
  log("Loading config from server...");
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const config = await res.json();
      if (config.gatewayUrl) gatewayUrl = config.gatewayUrl;
      if (config.gatewayToken) gatewayToken = config.gatewayToken;
      log("[Config] Loaded from server:", { gatewayUrl, hasToken: !!gatewayToken });
    }
  } catch (err) {
    logError("[Config] Failed to load from server:", err);
    log("[Config] Using default configuration");
  }
}

// Auto-resize textarea
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
});

// Send message on Enter (Shift+Enter for new line)
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

// Connect to gateway
function connect() {
  updateStatus("connecting");
  log(`Connecting to gateway: ${gatewayUrl}`);
  ws = new WebSocket(gatewayUrl);

  ws.onopen = () => {
    log("[WebSocket] Connected, waiting for challenge...");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      log(`[WebSocket] Received: type=${data.type}, event=${data.event || "N/A"}, id=${data.id || "N/A"}`);
      handleMessage(data);
    } catch (err) {
      logError("[WebSocket] Parse error:", err);
    }
  };

  ws.onclose = (event) => {
    connected = false;
    updateStatus("disconnected", `Disconnected (code: ${event.code})`);
    log(`[WebSocket] Closed: code=${event.code}, reason=${event.reason}`);
    
    // Reconnect after 3 seconds
    log("[WebSocket] Reconnecting in 3 seconds...");
    setTimeout(connect, 3000);
  };

  ws.onerror = (error) => {
    logError("[WebSocket] Error:", error);
    updateStatus("disconnected", "Connection error");
  };
}

function handleMessage(data: Record<string, unknown>) {
  // Handle connect challenge
  if (data.type === "event" && data.event === "connect.challenge") {
    sendConnect();
    return;
  }

  // Handle response frames
  if (data.type === "res") {
    const response = data as unknown as ResponseFrame;
    handleResponse(response);
    return;
  }

  // Handle event frames (chat updates)
  if (data.type === "event") {
    const event = data as unknown as EventFrame;
    handleEvent(event);
    return;
  }
}

function sendConnect() {
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
      token: gatewayToken || undefined,
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

  send(frame);
}

function send(frame: RequestFrame) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(frame));
  }
}

function handleResponse(response: ResponseFrame) {
  log("[Response]", response.id, response.ok ? "OK" : "ERROR");
  
  if (response.ok && response.payload && typeof response.payload === "object") {
    const payload = response.payload as { type?: string };
    
    if (payload.type === "hello-ok") {
      // Connected successfully
      log("[WebSocket] Connected successfully!");
      connected = true;
      updateStatus("connected", "Connected");
      sendBtn.disabled = false;
      messageInput.disabled = false;
      messageInput.focus();
      
      // Load chat history
      loadChatHistory();
    }
  }
}

function handleEvent(event: EventFrame) {
  log("[Event]", event.event, `seq=${event.seq || "N/A"}`);
  if (event.event === "chat") {
    const payload = event.payload as ChatEventPayload;
    handleChatEvent(payload);
  }
}

function handleChatEvent(payload: ChatEventPayload) {
  log("[Chat Event]", `session=${payload.sessionKey}`, `run=${payload.runId}`, `state=${payload.state}`);
  
  if (payload.state === "final" && payload.message) {
    // Assistant response complete
    const content = payload.message.content
      .map((c) => c.text)
      .join("");
    log(`[Chat] Assistant response: ${content.slice(0, 100)}...`);
    addMessage("assistant", content);
    
    // Remove loading indicator
    const loading = document.querySelector(".loading");
    loading?.remove();
  } else if (payload.state === "error" && payload.errorMessage) {
    log(`[Chat] Error: ${payload.errorMessage}`);
    const loading = document.querySelector(".loading");
    loading?.remove();
    addMessage("assistant", `Error: ${payload.errorMessage}`);
  }
}

async function loadChatHistory() {
  log("[History] Loading chat history...");
  const frame: RequestFrame = {
    type: "req",
    id: crypto.randomUUID(),
    method: "chat.history",
    params: {
      sessionKey,
      limit: 50,
    },
  };

  try {
    const response = await sendWithResponse<ChatHistoryResponse>(frame);
    if (response && response.messages) {
      log(`[History] Loaded ${response.messages.length} messages`);
      for (const msg of response.messages.reverse()) {
        const role = msg.message?.role || "unknown";
        const content = msg.message?.content
          ?.map((c) => c.text)
          ?.join("") || "";
        addMessage(role, content, false);
      }
    }
  } catch (err) {
    logError("Failed to load history:", err);
  }
}

function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !connected) {
    log(`[Chat] Cannot send: content=${!!content}, connected=${connected}`);
    return;
  }

  log(`[Chat] Sending message: "${content.slice(0, 50)}..."`);
  
  // Clear input
  messageInput.value = "";
  messageInput.style.height = "auto";

  // Add user message
  addMessage("user", content);

  // Show loading
  showLoading();

  // Send to gateway
  const frame: RequestFrame = {
    type: "req",
    id: crypto.randomUUID(),
    method: "chat.send",
    params: {
      sessionKey,
      message: content,
      idempotencyKey: crypto.randomUUID(),
    },
  };

  send(frame);
}

function addMessage(role: string, content: string, scroll = true) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  
  const roleDiv = document.createElement("div");
  roleDiv.className = "role";
  roleDiv.textContent = role === "user" ? "You" : "Assistant";
  
  const contentDiv = document.createElement("div");
  contentDiv.className = "content";
  contentDiv.textContent = content;
  
  messageDiv.appendChild(roleDiv);
  messageDiv.appendChild(contentDiv);
  chatContainer.appendChild(messageDiv);
  
  if (scroll) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "loading message assistant";
  loadingDiv.innerHTML = `
    <div class="spinner"></div>
    <span>Thinking...</span>
  `;
  chatContainer.appendChild(loadingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateStatus(status: "connected" | "connecting" | "disconnected", text?: string) {
  statusDot.className = `status-dot ${status}`;
  
  switch (status) {
    case "connected":
      statusText.textContent = text || "Connected";
      break;
    case "connecting":
      statusText.textContent = "Connecting...";
      break;
    case "disconnected":
      statusText.textContent = text || "Disconnected";
      sendBtn.disabled = true;
      messageInput.disabled = true;
      break;
  }
}

function sendWithResponse<T>(frame: RequestFrame): Promise<T | null> {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logError("[WebSocket] Cannot send, not connected");
      resolve(null);
      return;
    }

    log(`[WebSocket] Sending request: ${frame.method} (${frame.id})`);

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "res" && data.id === frame.id) {
          log(`[WebSocket] Received response: ${frame.method} (${frame.id}) ok=${data.ok}`);
          ws?.removeEventListener("message", handler);
          resolve(data.ok ? (data.payload as T) : null);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.addEventListener("message", handler);
    ws.send(JSON.stringify(frame));
    
    // Timeout after 10 seconds
    setTimeout(() => {
      ws?.removeEventListener("message", handler);
      log(`[WebSocket] Request timeout: ${frame.method} (${frame.id})`);
      resolve(null);
    }, 10000);
  });
}

// Initialize
async function init() {
  log("Initializing webot client...");
  await loadConfig();
  connect();
}

init();
