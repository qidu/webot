// Moltbot integration for webot
// This file should be placed in the moltbot repository

import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

export type HooksRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<boolean>;

export interface WebotIntegrationOptions {
  /** Base path for webot (default: "/webot") */
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

/**
 * Creates a webot HTTP request handler for integration with moltbot
 * This follows the moltbot handler pattern (returns true if handled, false otherwise)
 */
export function createWebotIntegrationHandler(options: WebotIntegrationOptions = {}): HooksRequestHandler {
  const {
    basePath = "/webot",
    staticDir = join(process.cwd(), "node_modules", "webot"),
    gatewayUrl = "ws://localhost:18789/",
    gatewayToken = process.env.GATEWAY_TOKEN || "",
    debug = process.env.DEBUG === "true",
  } = options;

  function log(...args: unknown[]) {
    if (debug) console.log("[moltbot:webot]", new Date().toISOString(), ...args);
  }

  function logError(...args: unknown[]) {
    console.error("[moltbot:webot:error]", new Date().toISOString(), ...args);
  }

  // Static file serving (simplified version)
  async function serveStaticFile(filePath: string, res: ServerResponse): Promise<boolean> {
    try {
      const { statSync, readFileSync } = await import("node:fs");
      const { extname } = await import("node:path");

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
    try {
      const served = await serveStaticFile(filePath, res);
      if (served) return true;
    } catch (err) {
      logError(`Error serving ${filePath}:`, err);
    }

    // File not found - try to serve index.html
    const indexPath = join(staticDir, "index.html");
    try {
      const served = await serveStaticFile(indexPath, res);
      if (served) return true;
    } catch (err) {
      logError(`Error serving index.html:`, err);
    }

    // 404 Not Found
    log(`404 Not Found: ${url.pathname}`);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return true;
  };
}

/**
 * Configuration for webot integration in moltbot
 */
export interface WebotMoltbotConfig {
  /** Enable webot integration */
  enabled?: boolean;
  /** Base path for webot (default: "/webot") */
  basePath?: string;
  /** Directory containing webot static files */
  staticDir?: string;
  /** Gateway WebSocket URL (overrides default) */
  gatewayUrl?: string;
  /** Gateway auth token (overrides environment) */
  gatewayToken?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Creates webot integration based on moltbot configuration
 */
export function createWebotIntegrationFromConfig(config: WebotMoltbotConfig = {}) {
  const {
    enabled = true,
    basePath = "/webot",
    staticDir = join(process.cwd(), "node_modules", "webot"),
    gatewayUrl,
    gatewayToken,
    debug = false,
  } = config;

  if (!enabled) {
    return null;
  }

  return createWebotIntegrationHandler({
    basePath,
    staticDir,
    gatewayUrl,
    gatewayToken,
    debug,
  });
}

// Example usage in moltbot's server-http.ts:
/*
import { createWebotIntegrationHandler } from "./webot-integration";

// In createGatewayHttpServer function:
const handleWebotRequest = createWebotIntegrationHandler({
  basePath: "/webot",
  staticDir: join(__dirname, "..", "node_modules", "webot"),
  gatewayUrl: "ws://localhost:18789/",
  gatewayToken: resolvedAuth.token,
  debug: process.env.DEBUG === "true",
});

// In handleRequest function, add to handler chain:
if (handleWebotRequest && (await handleWebotRequest(req, res))) return;
*/