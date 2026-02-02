// Chat service implementation
import type { ChatService, WebSocketAPI } from './api';
import type { ConsoleLogger } from './logger';

export class WebChatService implements ChatService {
  private wsService: WebSocketAPI;
  private logger: ConsoleLogger;
  private chatContainer: HTMLElement;
  private messageInput: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;

  constructor(
    wsService: WebSocketAPI,
    logger: ConsoleLogger,
    chatContainerId = "chat-container",
    messageInputId = "message-input",
    sendBtnId = "send-btn"
  ) {
    this.wsService = wsService;
    this.logger = logger;

    // Get DOM elements
    this.chatContainer = document.getElementById(chatContainerId)!;
    this.messageInput = document.getElementById(messageInputId) as HTMLTextAreaElement;
    this.sendBtn = document.getElementById(sendBtnId) as HTMLButtonElement;

    if (!this.chatContainer || !this.messageInput || !this.sendBtn) {
      throw new Error("Required DOM elements not found");
    }

    // Set up event listeners
    this.setupEventListeners();
  }

  // Setup event listeners
  private setupEventListeners(): void {
    // Auto-resize textarea
    this.messageInput.addEventListener("input", () => {
      this.messageInput.style.height = "auto";
      this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + "px";
    });

    // Send message on Enter (Shift+Enter for new line)
    this.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.sendBtn.addEventListener("click", () => this.sendMessage());
  }

  // Send message
  async sendMessage(): Promise<void> {
    const content = this.messageInput.value.trim();
    const connected = this.wsService.getConnectionState().status === "connected";

    if (!content || !connected) {
      this.logger.log(`[Chat] Cannot send: content=${!!content}, connected=${connected}`);
      return;
    }

    this.logger.log(`[Chat] Sending message: "${content.slice(0, 50)}..."`);

    // Clear input
    this.messageInput.value = "";
    this.messageInput.style.height = "auto";

    // Add user message
    this.addMessage("user", content);

    // Show loading
    this.showLoading();

    // Send to gateway
    try {
      await this.wsService.sendChatMessage({
        sessionKey: this.wsService.getSessionKey(),
        message: content,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (err) {
      this.logger.error("[Chat] Failed to send message:", err);
      this.hideLoading();
      this.addMessage("assistant", `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Load chat history
  async loadHistory(limit = 50): Promise<void> {
    this.logger.log("[History] Loading chat history...");

    try {
      const history = await this.wsService.getChatHistory({
        sessionKey: this.wsService.getSessionKey(),
        limit,
      });

      if (history && history.messages) {
        this.logger.log(`[History] Loaded ${history.messages.length} messages`);

        // Add messages in chronological order
        for (const msg of history.messages.reverse()) {
          const role = msg.message?.role || "unknown";
          const content = msg.message?.content
            ?.map((c) => c.text)
            ?.join("") || "";
          this.addMessage(role, content, false);
        }
      }
    } catch (err) {
      this.logger.error("Failed to load history:", err);
    }
  }

  // Add message to chat container
  addMessage(role: string, content: string, scroll = true): void {
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
    this.chatContainer.appendChild(messageDiv);

    if (scroll) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  // Show loading indicator
  showLoading(): void {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "loading message assistant";
    loadingDiv.innerHTML = `
      <div class="spinner"></div>
      <span>Thinking...</span>
    `;
    this.chatContainer.appendChild(loadingDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  // Hide loading indicator
  hideLoading(): void {
    const loading = document.querySelector(".loading");
    loading?.remove();
  }

  // Clear chat container
  clear(): void {
    this.chatContainer.innerHTML = "";
  }

  // Update UI state based on connection status
  updateUIForConnection(status: "connected" | "connecting" | "disconnected", error?: string): void {
    switch (status) {
      case "connected":
        this.sendBtn.disabled = false;
        this.messageInput.disabled = false;
        this.messageInput.focus();
        break;
      case "disconnected":
        this.sendBtn.disabled = true;
        this.messageInput.disabled = true;
        break;
    }
  }

  // Getter for DOM elements (for testing/mocking)
  getChatContainer(): HTMLElement {
    return this.chatContainer;
  }

  getMessageInput(): HTMLTextAreaElement {
    return this.messageInput;
  }

  getSendButton(): HTMLButtonElement {
    return this.sendBtn;
  }
}