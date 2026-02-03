#!/usr/bin/env node

// Test script to verify webot integration setup
// This simulates how moltbot would integrate webot

import { createServer } from 'http';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Import the HTTP-only handler
const { createWebotHttpHandler } = await import('./src/server-http-only.js');

// Create webot handler
const handleWebotRequest = createWebotHttpHandler({
  basePath: '/webot',
  staticDir: join(__dirname),
  gatewayUrl: 'ws://localhost:18789/',
  gatewayToken: process.env.GATEWAY_TOKEN || 'test-token',
  debug: true,
});

// Simulate moltbot's HTTP request chain
async function simulateMoltbotRequest(req, res) {
  console.log(`\n=== Simulating request: ${req.method} ${req.url}`);

  // Simulate moltbot handler chain
  // 1. Try webot handler first
  const handledByWebot = await handleWebotRequest(req, res);
  if (handledByWebot) {
    console.log('✅ Handled by webot');
    return;
  }

  // 2. Other handlers would go here...
  // if (handleHooksRequest && (await handleHooksRequest(req, res))) return;
  // if (handleControlUiRequest && (await handleControlUiRequest(req, res))) return;

  // 3. Fallback 404
  console.log('❌ Not handled by any handler');
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// Test cases
const testCases = [
  { url: '/webot', expected: 'handled' },
  { url: '/webot/index.html', expected: 'handled' },
  { url: '/webot/api/config', expected: 'handled' },
  { url: '/webot/dist/main.js', expected: 'handled' },
  { url: '/webot/nonexistent', expected: 'handled (falls back to index.html)' },
  { url: '/control-ui', expected: 'not handled' },
  { url: '/hooks/test', expected: 'not handled' },
  { url: '/', expected: 'not handled' },
];

// Run tests
console.log('🧪 Testing webot integration...\n');

for (const test of testCases) {
  const req = {
    url: test.url,
    method: 'GET',
    headers: {
      host: 'localhost:8080'
    }
  };

  const res = {
    writeHead: (code, headers) => {
      console.log(`  Status: ${code}`);
      console.log(`  Headers:`, headers);
    },
    end: (data) => {
      if (test.url === '/webot/api/config') {
        console.log(`  Response: ${data.substring(0, 100)}...`);
      } else {
        console.log(`  Response: ${data ? `[${data.length} bytes]` : 'empty'}`);
      }
    }
  };

  console.log(`Test: ${test.url}`);
  await simulateMoltbotRequest(req, res);
  console.log(`Expected: ${test.expected}\n`);
}

// Test standalone server
console.log('\n=== Testing standalone HTTP-only server ===\n');
const { createStandaloneServer } = await import('./src/server-http-only.js');

const server = createStandaloneServer({
  basePath: '/webot',
  gatewayUrl: 'ws://localhost:18789/',
  gatewayToken: process.env.GATEWAY_TOKEN || 'test-token',
  debug: true,
});

console.log('Standalone server created. To test:');
console.log('1. Run: npm run serve:http-only');
console.log('2. Visit: http://localhost:3010/webot');
console.log('3. Check API: http://localhost:3010/webot/api/config');

console.log('\n✅ Integration test completed');
console.log('\n📋 Next steps for moltbot integration:');
console.log('1. Add webot to moltbot package.json:');
console.log('   "dependencies": { "webot": "file:../path/to/webot" }');
console.log('2. Run: pnpm install');
console.log('3. Copy moltbot-integration.ts to moltbot src/gateway/');
console.log('4. Update moltbot config (see moltbot-config-example.yml)');
console.log('5. Add webot handler to server-http.ts');
console.log('6. Build and run: pnpm gateway');
console.log('\n🌐 Webot will be available at: http://localhost:18789/webot');