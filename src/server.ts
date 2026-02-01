// Simple static file server with WebSocket proxy to Clawdbot gateway

import { createServer } from "node:http";
import { extname, join } from "node:path";
import { statSync, readFileSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";

// DEBUG LOG: Enable verbose logging
const DEBUG = process.env.DEBUG === "true";

function log(...args: unknown[]) {
  if (DEBUG) console.log("[DEBUG]", new Date().toISOString(), ...args);
}

function logError(...args: unknown[]) {
  console.error("[ERROR]", new Date().toISOString(), ...args);
}

const PORT = process.env.PORT || 3010;
const GATEWAY_URL = process.env.GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "61b222597d4e0452dea876e8096453537ddd0f5360551fa5";

log(`Starting webot server...`);
log(`PORT: ${PORT}, GATEWAY_URL: ${GATEWAY_URL}`);

// Static file serving
function serveStaticFile(filePath: string, res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (data?: string) => void }): boolean {
  try {
    log(`Serving static file: ${filePath}`);
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      log(`File not found: ${filePath}`);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return true;
    }

    const ext = extname(filePath);
    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = readFileSync(filePath);
    
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

// HTTP server
const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  log(`HTTP request: ${req.method} ${pathname}`);

  // API endpoint for config (public info only)
  if (pathname === "/api/config") {
    log(`Serving /api/config (no token)`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      gatewayUrl: GATEWAY_URL,
      gatewayToken: GATEWAY_TOKEN
      // Token is NOT exposed - server injects auth on WebSocket
    }));
    return;
  }

  // Serve index.html for root or HTML requests
  if (pathname === "/" || pathname.endsWith(".html")) {
    const filePath = join(import.meta.dirname || __dirname, "..", "index.html");
    if (serveStaticFile(filePath, res)) return;
  }

  // Serve static files from src directory
  if (pathname.startsWith("/src/")) {
    const filePath = join(import.meta.dirname || __dirname, "..", pathname);
    if (serveStaticFile(filePath, res)) return;
  }

  // Serve compiled files from dist directory
  if (pathname.startsWith("/dist/")) {
    const filePath = join(import.meta.dirname || __dirname, "..", pathname);
    if (serveStaticFile(filePath, res)) return;
  }

  // Default: serve index.html
  const filePath = join(import.meta.dirname || __dirname, "..", "index.html");
  serveStaticFile(filePath, res);
});

// WebSocket proxy server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  log(`[WebSocket] Client connected from ${clientIp}`);

  let gatewayWs: WebSocket | null = null;
  let connectNonce: string | null = null;

  function sendToGateway(data: string) {
    if (gatewayWs?.readyState === WebSocket.OPEN) {
      log(`[WebSocket] Forwarding to gateway: ${data.slice(0, 200)}...`);
      gatewayWs.send(data);
    } else {
      logError(`[WebSocket] Gateway not open, cannot send`);
    }
  }

  function broadcastClient(event: string, payload: unknown) {
    ws.send(JSON.stringify({ type: "event", event, payload }));
  }

  // Connect to gateway
  log(`[WebSocket] Connecting to gateway: ${GATEWAY_URL}`);
  gatewayWs = new WebSocket(GATEWAY_URL);

  gatewayWs.onopen = () => {
    log("[WebSocket] Connected to gateway");
  };

  gatewayWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data.toString());
      log(`[WebSocket] From gateway: type=${data.type}, event=${data.event || "N/A"}, id=${data.id || "N/A"}`);
      
      // Forward connect challenge to client
      if (data.type === "event" && data.event === "connect.challenge") {
        connectNonce = data.payload?.nonce || null;
        log(`[WebSocket] Challenge received, nonce: ${connectNonce}`);
        ws.send(event.data.toString());
        return;
      }

      // Forward responses and events
      ws.send(event.data.toString());
    } catch (err) {
      logError("[WebSocket] Error forwarding message:", err);
    }
  };

  gatewayWs.onclose = (event) => {
    log(`[WebSocket] Gateway closed: code=${event.code}, reason=${event.reason}`);
    gatewayWs = null;
    ws.close();
  };

  gatewayWs.onerror = (err) => {
    logError("[WebSocket] Gateway error:", err);
  };

  // Handle messages from client
  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      log(`[WebSocket] From client: type=${parsed.type}, method=${parsed.method || "N/A"}, id=${parsed.id || "N/A"}`);

      // Intercept connect request to add auth
      if (parsed.type === "req" && parsed.method === "connect") {
        log(`[WebSocket] Adding auth token to connect request`);
        parsed.params = {
          ...parsed.params,
          auth: {
            token: GATEWAY_TOKEN,
          },
        };
      }

      // Forward to gateway
      sendToGateway(JSON.stringify(parsed));
    } catch (err) {
      logError("[WebSocket] Error handling client message:", err);
    }
  });

  ws.on("close", () => {
    log("[WebSocket] Client disconnected");
    gatewayWs?.close();
  });

  ws.on("error", (err) => {
    logError("[WebSocket] Client error:", err);
    gatewayWs?.close();
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Webot server running at http://localhost:${PORT}`);
  console.log(`📡 Gateway: ${GATEWAY_URL}`);
});
