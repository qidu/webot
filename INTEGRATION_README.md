# Webot Integration with Moltbot

This document describes how to integrate webot as a path in moltbot at `http://127.0.0.1:18789/webot`.

## Architecture Overview

```
Moltbot Gateway (port 18789)
├── HTTP Server
│   ├── /hooks/...           → hooks handler
│   ├── /tools/invoke        → tools handler
│   ├── /control-ui/...      → control UI handler
│   ├── /webot/...           → webot handler (NEW)
│   └── ... other handlers
│
├── WebSocket Server
│   └── ws://127.0.0.1:18789  → Gateway protocol
│
└── Webot Frontend
    ├── HTTP: Served from /webot path
    └── WebSocket: Connects directly to ws://127.0.0.1:18789
```

## Changes Made to Webot

### 1. **HTTP-only Server** (`src/server-http-only.ts`)
- Removed WebSocket proxy functionality
- Exports handler function compatible with moltbot pattern
- Serves static files and `/api/config` endpoint
- Returns `true` if handled, `false` to pass to next handler

### 2. **Frontend Updates**
- WebSocket connection now points directly to `ws://127.0.0.1:18789`
- Authentication token injected in `connect` request (not proxied)

### 3. **Moltbot Integration Handler** (`moltbot-integration.ts`)
- Handler function following moltbot's `HooksRequestHandler` pattern
- Configurable base path, static directory, gateway URL
- Easy integration into moltbot's HTTP request chain

## Integration Steps

### Step 1: Install Webot as Dependency

In moltbot's `package.json`:

```json
{
  "dependencies": {
    "webot": "file:../path/to/webot"
  }
}
```

Or from GitHub:

```json
{
  "dependencies": {
    "webot": "github:your-username/webot"
  }
}
```

Then install:

```bash
cd /path/to/moltbot
pnpm install
```

### Step 2: Update Moltbot Configuration

Add to `~/.moltbot/config.yml`:

```yaml
gateway:
  webot:
    enabled: true
    basePath: "/webot"
    # Optional overrides:
    # staticDir: "/path/to/webot"
    # gatewayUrl: "ws://127.0.0.1:18789"
    # gatewayToken: "your-token"
    # debug: false
```

### Step 3: Integrate into Moltbot Code

In `src/gateway/server-http.ts`:

```typescript
// Import the integration handler
import { createWebotIntegrationHandler } from "./webot-integration";

// In createGatewayHttpServer function, add webot handler:
const handleWebotRequest = createWebotIntegrationHandler({
  basePath: "/webot",
  staticDir: join(__dirname, "..", "node_modules", "webot"),
  gatewayUrl: "ws://127.0.0.1:18789",
  gatewayToken: resolvedAuth.token,
  debug: process.env.DEBUG === "true",
});

// In handleRequest function, add to handler chain (around line 443-449):
if (handleWebotRequest && (await handleWebotRequest(req, res))) return;
```

### Step 4: Copy Integration Files

Copy these files to moltbot:
- `moltbot-integration.ts` → `src/gateway/webot-integration.ts`

### Step 5: Build and Run

```bash
# Build moltbot
cd /path/to/moltbot
pnpm build

# Run gateway with webot integration
pnpm gateway
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable webot integration |
| `basePath` | `"/webot"` | URL path for webot |
| `staticDir` | `node_modules/webot` | Directory with webot static files |
| `gatewayUrl` | `ws://127.0.0.1:18789` | WebSocket URL for frontend |
| `gatewayToken` | (from env/config) | Auth token for gateway |
| `debug` | `false` | Enable debug logging |

## Development Workflow

### Standalone Development (Port 3010)

```bash
cd /path/to/webot
npm run dev  # Runs on http://127.0.0.1:3010 with WebSocket proxy
```

### Integrated Development (Port 18789)

```bash
# In webot directory:
npm run build

# In moltbot directory:
pnpm gateway  # Webot available at http://127.0.0.1:18789/webot
```

## Authentication Flow

1. **Frontend loads** from `http://127.0.0.1:18789/webot`
2. **Fetches config** from `/webot/api/config` (gets gateway URL)
3. **Connects WebSocket** to `ws://127.0.0.1:18789`
4. **Receives challenge** `connect.challenge` event
5. **Sends connect request** with auth token (from config/environment)
6. **Receives `hello-ok`** response on successful auth

## File Structure After Integration

```
moltbot/
├── src/
│   └── gateway/
│       ├── server-http.ts          # Updated with webot handler
│       └── webot-integration.ts    # Integration handler
├── node_modules/
│   └── webot/                      # Webot static files
│       ├── index.html
│       ├── dist/
│       └── src/
└── package.json                    # With webot dependency

webot/ (original)
├── src/
│   ├── server-http-only.ts         # HTTP-only handler
│   ├── server.ts                   # Original (for standalone)
│   └── services/                   # Frontend services
├── dist/                           # Compiled frontend
├── index.html                      # Main HTML
└── package.json
```

## Troubleshooting

### WebSocket Connection Issues
- Check gateway is running on port 18789
- Verify auth token is correct
- Check CORS settings if accessing from different origin

### Static Files Not Serving
- Verify `staticDir` points to correct location
- Check webot is installed as dependency
- Ensure build was run: `npm run build` in webot

### 404 Errors for `/webot`
- Verify handler is added to request chain
- Check base path configuration
- Ensure handler returns `true` for webot paths

## Benefits of This Approach

1. **Simplified Architecture**: No WebSocket proxy in webot
2. **Direct Gateway Connection**: Better performance
3. **Consistent Authentication**: Uses same auth as other clients
4. **Easy Integration**: Follows moltbot handler pattern
5. **Development Flexibility**: Can run standalone or integrated

## Migration from Standalone Webot

If migrating from standalone webot (port 3010):

1. Remove WebSocket proxy from webot server
2. Integrate HTTP handler into moltbot
3. Update any bookmarks from `http://127.0.0.1:3010` to `http://127.0.0.1:18789/webot`
