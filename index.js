import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, 'dist');

// AWS Lambda Web Functions sets AWS_LAMBDA_HTTP_ENDPOINT="<host>:<port>"
const endpoint = process.env.AWS_LAMBDA_HTTP_ENDPOINT || '127.0.0.1:3000';
const [host, portStr] = endpoint.split(':');
const port = Number(portStr || 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = (req.url || '/').split('?')[0];
    const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const indexData = await readFile(join(DIST_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexData);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found (Run "npm run build" before starting the server)');
    }
  }
});

server.listen(port, host, () => {
  console.log(`Lambda Web Function server running at http://${host}:${port}`);
});
