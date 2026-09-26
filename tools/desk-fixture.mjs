import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

// Entirely local: both email delivery and outbound network are replaced.
export function createFixture(origin = 'https://enablerhq.com', options = {}) {
  const emails = [];
  let mailFailure = false;
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: ['worker.mjs', 'knowledge.mjs', 'orders.mjs'].map(name => ({ type: 'ESModule', path: fileURLToPath(new URL(`../desk/${name}`, import.meta.url)) })),
    modulesRoot: fileURLToPath(new URL('../desk/', import.meta.url)),
    compatibilityDate: '2026-07-01',
    host: '127.0.0.1', port: 0,
    durableObjects: { DESK: { className: 'InvestorDesk', useSQLite: true }, ORDERS: { className: 'OrderDesk', useSQLite: true } },
    bindings: { AUTH_SECRET: randomBytes(32).toString('hex'), ALLOWED_ORIGIN: origin, RESEND_API_KEY: 'local-fake', MAIL_FROM: 'Preview <preview@example.test>', OWNER_EMAIL: 'owner@example.test', ...options.bindings },
    serviceBindings: { MAILER: async request => {
      if (mailFailure) return new Response('', { status: 503 });
      emails.push(await request.json());
      return Response.json({ id: 'local-only' });
    }, ...(options.stripe ? { STRIPE: options.stripe } : {}) },
    outboundService: () => new Response('Network disabled in local fixture', { status: 503 }),
  }));
  let ip = 0;
  async function request(path, payload, cookie, extraHeaders = {}) {
    return mf.dispatchFetch(`${origin}/api/investors/${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': `192.0.2.${++ip}`, ...(cookie ? { cookie } : {}), ...extraHeaders },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  }
  async function start(email = 'visitor@example.test') {
    const response = await request('auth/request', { email, consent: true, language: 'en' });
    if (!response.ok) throw new Error(`start: ${response.status} ${await response.text()}`);
    const data = await response.json();
    const code = emails.at(-1).text.match(/\b\d{6}\b/)[0];
    return { email, code, challenge: data.challenge };
  }
  async function login(email) {
    const credentials = await start(email);
    const response = await request('auth/verify', credentials);
    if (!response.ok) throw new Error(`verify: ${response.status} ${await response.text()}`);
    return { credentials, cookie: response.headers.get('set-cookie').split(';')[0], response };
  }
  return { mf, emails, request, start, login, failMail: () => { mailFailure = true; } };
}
