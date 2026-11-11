import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { search } from './src/search.js';

const port = Number(process.env.PORT) || 3000;
const page = fileURLToPath(new URL('./public/index.html', import.meta.url));

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');

  if (url.pathname === '/api/search') {
    const books = search(url.searchParams.get('q') ?? '');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(books));
    return;
  }

  if (url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html' });
    createReadStream(page).pipe(response);
    return;
  }

  response.writeHead(404);
  response.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Tiny Library is running at http://localhost:${port}`);
});
