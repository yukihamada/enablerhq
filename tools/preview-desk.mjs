import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createFixture } from './desk-fixture.mjs';

const csp = "default-src 'self'; script-src 'self' https://enabler-analytics.fly.dev; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self'; connect-src 'self' https://enabler-analytics.fly.dev; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";
const files = new Map([
  ['/investors/', ['investors/index.html', 'text/html; charset=utf-8']],
  ...['investors.css', 'investors.js', 'desk.js', 'orders.js'].map(name => [`/investors/${name}`, [`investors/${name}`, name.endsWith('.css') ? 'text/css' : 'text/javascript']]),
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);

export async function startPreview(port = 18848, options = {}) {
  let fixture;
  const server = createServer(async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-security-policy', csp);
    res.setHeader('x-content-type-options', 'nosniff');
    try {
      if (req.headers.host !== `127.0.0.1:${server.address().port}`) { res.writeHead(403).end(); return; }
      const origin = `http://${req.headers.host}`;
      const pathname = new URL(req.url, origin).pathname;
      if (pathname === '/__desk-preview' && req.method === 'GET') {
        res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ preview: true })); return;
      }
      if (pathname.startsWith('/api/investors/')) {
        if (!fixture) { res.writeHead(503).end(); return; }
        const chunks = []; let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
           if (length > 32768) { res.writeHead(413).end(); return; }
          chunks.push(chunk);
        }
        const body = chunks.length ? Buffer.concat(chunks).toString() : undefined;
        // Only a synthetic address can request a demo code. No real mail is sent.
        if (pathname === '/api/investors/auth/request' && !['preview@example.test', 'owner@example.test'].includes(JSON.parse(body || '{}').email)) {
          res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'email' })); return;
        }
        const response = await fixture.mf.dispatchFetch(`${origin}${pathname}`, {
          method: req.method, headers: { ...req.headers, 'cf-connecting-ip': '127.0.0.1' }, body,
        });
        for (const [key, value] of response.headers) res.setHeader(key, value);
        res.statusCode = response.status;
        const data = await response.json();
        if (pathname === '/api/investors/auth/request' && response.ok) data.previewCode = fixture.emails.at(-1).text.match(/\b\d{6}\b/)[0];
        res.end(JSON.stringify(data)); return;
      }
      const asset = files.get(pathname);
      if (!asset || req.method !== 'GET') { res.writeHead(404).end(); return; }
      res.setHeader('content-type', asset[1]);
      res.end(await readFile(new URL(`../static/${asset[0]}`, import.meta.url)));
    } catch (error) {
      console.error('Local preview error:', error.message);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
   fixture = createFixture(origin, options);
  try { await fixture.mf.ready; } catch (error) { await fixture.mf.dispose(); server.close(); throw error; }
  return { origin, async close() { await new Promise(resolve => server.close(resolve)); await fixture.mf.dispose(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  const preview = await startPreview();
  console.log(`LOCAL DEMO: ${preview.origin}/investors/ — preview@example.test; no email delivery`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await preview.close(); process.exit(0); });
}
