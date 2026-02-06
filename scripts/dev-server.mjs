#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3000;

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

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(ROOT, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('404 Not Found');
    console.log(`[Dev 3000] GET ${req.url} 404 Not Found`);
    return;
  }

  let content = fs.readFileSync(filePath);

  // In-memory modifications for development
  if (filePath.endsWith('index.html')) {
    content = content.toString()
      .replace('src="./javascript/app.min.js"', 'src="./javascript/app.js"')
      .replace('href="./css/app.min.css"', 'href="./css/styles.css" />\n    <link rel="stylesheet" href="./css/modules.css"');
  }

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);

  console.log(`[Dev 3000] GET ${req.url} 200 OK`);
});

server.listen(PORT, () => {
  console.log(`[Dev 3000] Server ready`);
});
