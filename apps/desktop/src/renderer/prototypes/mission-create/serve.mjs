// PROTOTYPE ONLY — delete after the mission composer design decision.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('./', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = createServer(async (request, response) => {
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
});

server.listen(4179, '127.0.0.1', () => {
  console.log('Mission composer prototype: http://127.0.0.1:4179/?variant=A');
});
