// Webot - Clawdbot WebChat Client Frontend
// Refactored to use service architecture

import { createWebotService } from './services/index';

// DOM elements
const chatContainer = document.getElementById("chat-container")!;
const messageInput = document.getElementById("message-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const statusDot = document.getElementById("status-dot")!;
const statusText = document.getElementById("status-text")!;

// Create webot service
const webotService = createWebotService({
  chatContainerId: "chat-container",
  messageInputId: "message-input",
  sendBtnId: "send-btn"
});

// Update status UI
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
      break;
  }
}

// Initialize and start
async function init() {
  console.log("🚀 Initializing Webot...");

  // Listen for connection state changes
  const checkConnectionState = () => {
    const state = webotService.getConnectionState();
    updateStatus(state.status, state.lastError);
  };

  // Check connection state periodically
  setInterval(checkConnectionState, 1000);

  // Initialize the service
  await webotService.initialize();
}

// Start the application
init().catch(err => {
  console.error("Failed to initialize Webot:", err);
  updateStatus("disconnected", "Initialization failed");
});