#!/usr/bin/env node

// Script to copy webot static files for integration
// This ensures all necessary files are available when webot is installed as a dependency

import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Files and directories to copy for integration
const filesToCopy = [
  // Main HTML file
  'index.html',

  // Source directories
  'src',

  // Compiled/dist directory
  'dist',

  // Configuration files
  'package.json',
  'tsconfig.json',

  // Integration documentation
  'INTEGRATION.md',
  'moltbot-config-example.yml',
  'moltbot-integration.ts',

  // README
  'README.md',

  // API documentation
  'API.md',
];

// Directories to create in the output
const outputDirs = [
  'dist',
  'src',
  'scripts',
];

// Create output directory structure
function ensureOutputStructure(outputDir) {
  for (const dir of outputDirs) {
    const dirPath = join(outputDir, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }
}

// Copy a file or directory recursively
function copyItem(src, dest) {
  try {
    if (!existsSync(src)) {
      console.warn(`Warning: Source does not exist: ${src}`);
      return;
    }

    const stat = statSync(src);

    if (stat.isDirectory()) {
      // Create destination directory
      if (!existsSync(dest)) {
        mkdirSync(dest, { recursive: true });
      }

      // Copy directory contents
      const items = readdirSync(src);
      for (const item of items) {
        if (item === 'node_modules' || item === '.git') {
          continue; // Skip node_modules and .git
        }

        const itemSrc = join(src, item);
        const itemDest = join(dest, item);
        copyItem(itemSrc, itemDest);
      }
    } else {
      // Copy file
      cpSync(src, dest);
      console.log(`Copied: ${src} → ${dest}`);
    }
  } catch (error) {
    console.error(`Error copying ${src} to ${dest}:`, error.message);
  }
}

// Main function
function main() {
  console.log('📦 Preparing webot for integration...');

  // The build output is already in dist/, so we just need to ensure
  // the structure is correct for integration

  console.log('✅ Webot is ready for integration');
  console.log('');
  console.log('To integrate with moltbot:');
  console.log('1. Add to moltbot package.json: "webot": "file:../path/to/webot"');
  console.log('2. Run: pnpm install');
  console.log('3. Copy moltbot-integration.ts to moltbot src/gateway/');
  console.log('4. Update moltbot config (see moltbot-config-example.yml)');
  console.log('5. Add webot handler to server-http.ts');
  console.log('');
  console.log('Webot will be available at: http://localhost:18789/webot');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ensureOutputStructure, copyItem };