// Test script to verify sharp loads in Electron
const fs = require('fs');
const path = require('path');
const resultFile = path.join(__dirname, 'sharp-test-result.txt');

// Write immediately to confirm script is running
fs.writeFileSync(resultFile, 'Starting test...\n');

try {
  const sharp = require('sharp');
  fs.writeFileSync(resultFile, `SUCCESS: Sharp loaded successfully!\nSharp version: ${sharp.versions?.sharp || 'unknown'}`);
} catch (e) {
  fs.writeFileSync(resultFile, `FAILED: ${e.message}\n\n${e.stack}`);
}

// Exit without needing Electron app
process.exit(0);
