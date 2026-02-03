// HTTP-only webot server for integration with moltbot
// Exports a handler function that can be integrated into moltbot's HTTP request chain

import { extname, join } from "node:path";
import { statSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

export type HooksRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<boolean>;

export interface WebotHttpHandlerOptions {
  /** Base path for webot (e.g., "/webot") */
  basePath?: string;
  /** Directory containing webot static files */
  staticDir?: string;
  /** Gateway WebSocket URL (default: "ws://localhost:18789/") */
  gatewayUrl?: string;
  /** Gateway auth token */
  gatewayToken?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export function createWebotHttpHandler(options: WebotHttpHandlerOptions = {}): HooksRequestHandler {
  const {
    basePath = "/webot",
    staticDir = join(import.meta.dirname || __dirname, ".."),
    gatewayUrl = "ws://localhost:18789/",
    gatewayToken = process.env.GATEWAY_TOKEN || "",
    debug = process.env.DEBUG === "true",
  } = options;

  function log(...args: unknown[]) {
    if (debug) console.log("[webot]", new Date().toISOString(), ...args);
  }

  function logError(...args: unknown[]) {
    console.error("[webot:error]", new Date().toISOString(), ...args);
  }

  // Static file serving
  function serveStaticFile(filePath: string, res: ServerResponse): boolean {
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
      res.end(content.toString());
      return true;
    } catch (err) {
      logError(`Error serving static file ${filePath}:`, err);
      return false;
    }
  }

  // Main handler function
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Check if this is a webot path
    if (!url.pathname.startsWith(basePath)) {
      return false; // Not our request, pass to next handler
    }

    log(`HTTP request: ${req.method} ${url.pathname}`);

    // Remove base path prefix
    const relativePath = url.pathname.slice(basePath.length) || "/";

    // Handle /api/config endpoint
    if (relativePath === "/api/config") {
      log(`Serving /api/config`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        gatewayUrl,
        gatewayToken,
        // Token is NOT exposed - frontend must handle auth
      }));
      return true;
    }

    // Determine file path to serve
    let filePath: string;

    // Serve index.html for root or HTML requests
    if (relativePath === "/" || relativePath.endsWith(".html")) {
      filePath = join(staticDir, "index.html");
    }
    // Serve static files from src directory
    else if (relativePath.startsWith("/src/")) {
      filePath = join(staticDir, relativePath);
    }
    // Serve compiled files from dist directory
    else if (relativePath.startsWith("/dist/")) {
      filePath = join(staticDir, relativePath);
    }
    // Default: try to serve as static file
    else {
      filePath = join(staticDir, relativePath);
    }

    // Try to serve the file
    if (serveStaticFile(filePath, res)) {
      return true;
    }

    // File not found - try to serve index.html
    const indexPath = join(staticDir, "index.html");
    if (serveStaticFile(indexPath, res)) {
      return true;
    }

    // 404 Not Found
    log(`404 Not Found: ${url.pathname}`);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return true;
  };
}

// Standalone server for development/testing
export function createStandaloneServer(options: WebotHttpHandlerOptions = {}) {
  const { createServer } = require("node:http");

  const handler = createWebotHttpHandler(options);
  const port = process.env.PORT || 3010;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const handled = await handler(req, res);
    if (!handled) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  return {
    start: () => {
      server.listen(port, () => {
        console.log(`🚀 Webot HTTP server running at http://localhost:${port}`);
        console.log(`📡 Gateway: ${options.gatewayUrl || "ws://localhost:18789/"}`);
        console.log(`📁 Base path: ${options.basePath || "/webot"}`);
      });
      return server;
    },
    stop: () => {
      server.close();
    }
  };
}

// For backward compatibility - export default handler creator
export default createWebotHttpHandler;