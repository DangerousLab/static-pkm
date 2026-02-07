#!/usr/bin/env node

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function requestHandler(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(ROOT, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('404 Not Found');
    console.log(`[Prod 3001] GET ${req.url} 404 Not Found`);
    return;
  }

  const content = fs.readFileSync(filePath);

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);

  console.log(`[Prod 3001] GET ${req.url} 200 OK`);
}

// Get local IP addresses
function getLocalIPAddresses() {
  const addresses = [];
  const networkInterfaces = os.networkInterfaces();

  Object.keys(networkInterfaces).forEach(name => {
    networkInterfaces[name].forEach(net => {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    });
  });

  return addresses;
}

// Check if certificates exist
const certPath = path.join(ROOT, '.cert', 'cert.pem');
const keyPath = path.join(ROOT, '.cert', 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  // HTTPS server
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  const server = https.createServer(options, requestHandler);

  server.listen(PORT, () => {
    console.log(`[Prod 3001] ✅ HTTPS Server ready`);
    console.log(`[Prod 3001] 🔒 Access via:`);

    const addresses = getLocalIPAddresses();

    if (addresses.length > 0) {
      addresses.forEach(addr => {
        console.log(`[Prod 3001]    https://${addr}:${PORT}`);
      });
    }
    console.log(`[Prod 3001]    https://localhost:${PORT}`);
    console.log(`[Prod 3001] ⚠️  Accept certificate warning on first visit`);
  });
} else {
  // Fallback to HTTP
  console.log('[Prod 3001] ⚠️  No HTTPS certificates found (.cert/cert.pem, .cert/key.pem)');
  console.log('[Prod 3001] ⚠️  PWA Service Workers require HTTPS to function');
  console.log('[Prod 3001] ⚠️  Run setup-rollup.sh again to generate certificates');
  console.log('[Prod 3001] Starting HTTP server (service workers will not work)...');

  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`[Prod 3001] HTTP Server ready (no HTTPS)`);
    console.log(`[Prod 3001] http://localhost:${PORT}`);
  });
}
