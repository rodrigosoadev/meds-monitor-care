const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const path = require('path');

// Importar o servidor TanStack Start
let serverHandler;
try {
  const serverModule = require('../dist/server/index.js');
  serverHandler = serverModule.default || serverModule;
} catch (e) {
  console.error('Erro ao carregar servidor:', e);
}

module.exports = async (req, res) => {
  try {
    // Definir CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Servir arquivos estáticos do dist/client
    if (req.method === 'GET' && /^\/assets\//.test(req.url)) {
      const filePath = join(__dirname, '../dist/client', req.url);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2'
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.end(content);
      }
    }

    // Usar o servidor TanStack Start se disponível
    if (serverHandler && typeof serverHandler === 'function') {
      return serverHandler(req, res);
    }

    // Fallback: servir index.html
    const indexPath = join(__dirname, '../dist/client/index.html');
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.end(html);
    }

    res.statusCode = 404;
    res.end('Not Found');
  } catch (error) {
    console.error('Erro:', error);
    res.statusCode = 500;
    res.end('Server Error: ' + error.message);
  }
};
