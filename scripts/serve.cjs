// Dependency-free local preview. Stop with Ctrl+C.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const assets = new Set(['/index.html', '/styles.css', '/app.js', '/learning.js', '/vocabulary.js', '/kanji-ui.js', '/cloud.js', '/cloud-state.js', '/firebase-config.js', '/data/words.js', '/data/kanji-notes.js', '/data/kanji-details.js', '/data/kanji-all.js']);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  if (name === '/') name = '/index.html';
  if (!assets.has(name)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(root, name), (error, body) => {
    if (error) { res.writeHead(500); return res.end('Read failed'); }
    res.writeHead(200, { 'Content-Type': `${types[path.extname(name)]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(body);
  });
});
server.on('error', error => { console.error(`Server could not start: ${error.message}`); process.exitCode = 1; });
server.listen(8000, '127.0.0.1', () => console.log('하루 단어: http://127.0.0.1:8000 (종료: Ctrl+C)'));
