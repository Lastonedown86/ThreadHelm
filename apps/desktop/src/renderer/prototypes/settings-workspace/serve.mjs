import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const root = new URL('./', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
createServer(async (req, res) => {
  const p = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  const f = p === '/' ? 'index.html' : p.slice(1);
  try {
    const b = await readFile(join(root, f));
    res.writeHead(200, { 'Content-Type': `${types[extname(f)] ?? 'text/plain'}; charset=utf-8` });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(4183, '127.0.0.1', () =>
  console.log('Setup prototype: http://127.0.0.1:4183/?variant=A'),
);
