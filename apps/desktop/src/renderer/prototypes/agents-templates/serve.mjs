// PROTOTYPE ONLY — local static server for the Agents and Templates design gate.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('./', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

createServer(async (request, response) => {
  const requested = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const file = requested === '/' ? 'index.html' : requested.slice(1);
  try {
    const body = await readFile(join(root, file));
    response.writeHead(200, {
      'Content-Type': `${types[extname(file)] ?? 'text/plain'}; charset=utf-8`,
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(4181, '127.0.0.1', () => {
  console.log('Agents and templates prototype: http://127.0.0.1:4181/?variant=A');
});
