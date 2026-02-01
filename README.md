# Webot - Clawdbot WebChat Client

A simple web-based chat UI that connects to the Clawdbot gateway.

## Features

- Direct WebSocket connection to Clawdbot gateway
- Token-based authentication
- Chat history persistence
- Markdown-like rendering
- Auto-reconnect on disconnect

## Usage

### Development

```bash
cd projects/webot
npm install
npm run dev
```

This starts a development server at `http://localhost:3000`.

### Production

```bash
npm run serve
```

Or set environment variables:

```bash
GATEWAY_URL=ws://127.0.0.1:18789 \
GATEWAY_TOKEN=your-token \
npm run serve
```

## Configuration

The webchat can be configured via:

1. **Environment variables** (for server):
   - `GATEWAY_URL` - Gateway WebSocket URL (default: `ws://127.0.0.1:18789`)
   - `GATEWAY_TOKEN` - Gateway auth token
   - `PORT` - HTTP server port (default: 3000)

2. **Server-side config** - The `/api/config` endpoint serves config to the frontend

3. **Client-side defaults** - Default values in `main.ts`

## Gateway Connection

The client connects using the Clawdbot gateway protocol:

1. Opens WebSocket connection to `ws://127.0.0.1:18789`
2. Receives `connect.challenge` event with nonce
3. Sends `connect` request with auth token
4. Receives `hello-ok` response on success
5. Uses `chat.history`, `chat.send`, and listens for `chat` events

## Files

```
projects/webot/
├── index.html       # Main HTML page with embedded styles
├── package.json     # Project configuration
└── src/
    ├── main.ts      # Frontend JavaScript (runs in browser)
    └── server.ts    # Static file server with WebSocket proxy
```