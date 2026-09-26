import { answerQuestion } from './knowledge.mjs';
export { OrderDesk } from './orders.mjs';

const DAY = 86400000;
const SESSION_AGE = 7 * DAY;
const encoder = new TextEncoder();
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const fail = (error, status = 400, extra = {}) => json({ error, ...extra }, status);
const day = now => new Date(now).toISOString().slice(0, 10);
const resetAt = now => new Date((Math.floor(now / DAY) + 1) * DAY).toISOString();
const random = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function canonicalEmail(input) {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)) return null;
  let [local, domain] = email.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || domain.includes('..')) return null;
  if (domain === 'gmail.com' || domain === 'googlemail.com') { domain = 'gmail.com'; local = local.split('+')[0].replaceAll('.', ''); }
  return local ? `${local}@${domain}` : null;
}
async function bodyJSON(request, maxBytes = 8192) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('invalid_body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new Error('invalid_body'); }
    chunks.push(value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  const result = JSON.parse(new TextDecoder().decode(joined));
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid_body');
  return result;
}
function cookie(env, value, maxAge) {
  const local = new URL(env.ALLOWED_ORIGIN).hostname === '127.0.0.1';
  return `desk_session=${value}; Path=/api/investors; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${local ? '' : '; Secure'}`;
}
async function session(request, env) {
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)desk_session=([a-f0-9]+\.[a-f0-9]+)/)?.[1];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (await hmac(env.AUTH_SECRET, payload) !== signature) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(payload.match(/../g), hex => parseInt(hex, 16))));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
async function sign(data, env) {
  const payload = [...encoder.encode(JSON.stringify(data))].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${payload}.${await hmac(env.AUTH_SECRET, payload)}`;
}
async function call(env, name, path, body) {
  return env.DESK.get(env.DESK.idFromName(name)).fetch(`https://internal${path}`, { method: 'POST', body: JSON.stringify(body) });
}
async function sendCode(env, to, code, lang) {
  const en = lang === 'en';
  const request = new Request('https://api.resend.com/emails', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: en ? 'Enabler: your verification code' : 'Enabler：メール認証コード', text: en ? `Your Enabler verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email. This does not subscribe you to marketing emails.` : `Enablerの認証コードは ${code} です。有効期限は10分です。心当たりがなければ破棄してください。営業メールへの登録は行いません。` }),
    signal: AbortSignal.timeout(10000),
  });
  const response = env.MAILER ? await env.MAILER.fetch(request) : await fetch(request);
  if (!response.ok) throw new Error('mail_unavailable');
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/investors/')) return fail('not_found', 404);
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || !env.ALLOWED_ORIGIN) return fail('unavailable', 503);
    if (request.method === 'POST' && request.headers.get('origin') !== env.ALLOWED_ORIGIN) return fail('origin', 403);
    try {
      if (request.method === 'POST' && path === '/api/investors/auth/request') {
        if (!env.RESEND_API_KEY || !env.MAIL_FROM) return fail('unavailable', 503);
        const input = await bodyJSON(request);
        const email = canonicalEmail(input.email);
        if (!email) return fail('email');
        if (input.consent !== true) return fail('consent');
        const subject = await hmac(env.AUTH_SECRET, `email:${email}`);
        // Cloudflare supplies this header; no X-Forwarded-For trust. Never retain a raw IP.
        const ip = await hmac(env.AUTH_SECRET, `ip:${request.headers.get('cf-connecting-ip') || 'local'}`);
        const allowed = await call(env, 'mail-guard', '/rate', { ip });
        if (!allowed.ok) return allowed;
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
        const challenge = random();
        const prepared = await call(env, subject, '/prepare', { challenge, codeHash: await hash(`${challenge}:${code}`) });
        if (!prepared.ok) return prepared;
        try { await sendCode(env, email, code, input.language); }
        catch {
          await call(env, subject, '/invalidate', { challenge });
          return fail('mail_unavailable', 503);
        }
        return json({ sent: true, challenge, expiresIn: 600 });
      }
      if (request.method === 'POST' && path === '/api/investors/auth/verify') {
        const input = await bodyJSON(request);
        const email = canonicalEmail(input.email);
        if (!email || !/^[0-9]{6}$/.test(input.code) || !/^[a-f0-9]{64}$/.test(input.challenge)) return fail('invalid_code');
        const subject = await hmac(env.AUTH_SECRET, `email:${email}`);
        const id = random();
        const exp = Date.now() + SESSION_AGE;
        const response = await call(env, subject, '/verify', { challenge: input.challenge, codeHash: await hash(`${input.challenge}:${input.code}`), id, exp, email });
        if (!response.ok) return response;
        return json(await response.json(), 200, { 'set-cookie': cookie(env, await sign({ sub: subject, id, exp }, env), SESSION_AGE / 1000) });
      }
      const auth = await session(request, env);
      if (!auth) return fail('unauthenticated', 401);
      if (request.method === 'GET' && path === '/api/investors/session') {
        const response = await call(env, auth.sub, '/identity', auth);
        if (!response.ok) return response;
        const identity = await response.json();
        return json({ remaining: identity.remaining, resetAt: identity.resetAt, admin: !!env.OWNER_EMAIL && identity.email === canonicalEmail(env.OWNER_EMAIL) });
      }
      if (path.startsWith('/api/investors/orders')) {
        if (!env.ORDERS || !env.OWNER_EMAIL) return fail('unavailable', 503);
        const response = await call(env, auth.sub, '/identity', auth);
        if (!response.ok) return response;
        const identity = await response.json();
        if (!identity.email) return fail('unauthenticated', 401);
        const admin = identity.email === canonicalEmail(env.OWNER_EMAIL);
        const action = path.slice('/api/investors/orders'.length);
        if (!(request.method === 'GET' && action === '') && !(request.method === 'POST' && ['', '/quote', '/delivered', '/checkout', '/reconcile', '/portal'].includes(action))) return fail('not_found', 404);
        const input = request.method === 'POST' ? await bodyJSON(request, 32768) : {};
        return env.ORDERS.get(env.ORDERS.idFromName('orders')).fetch(`https://internal${action || (request.method === 'GET' ? '/list' : '/create')}`, {
          method: 'POST', body: JSON.stringify({ ...input, owner: auth.sub, email: identity.email, admin }),
        });
      }
      if (request.method === 'POST' && path === '/api/investors/logout') {
        await call(env, auth.sub, '/logout', auth);
        return json({ ok: true }, 200, { 'set-cookie': cookie(env, '', 0) });
      }
      if (request.method === 'POST' && path === '/api/investors/ask') {
        const input = await bodyJSON(request);
        if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 1200 || !/^[a-zA-Z0-9-]{16,64}$/.test(input.requestId)) return fail('question');
        const language = input.language === 'en' ? 'en' : 'ja';
        const quota = await call(env, auth.sub, '/consume', { ...auth, requestId: input.requestId, fingerprint: await hash(`${input.question}:${language}`) });
        if (!quota.ok) return quota;
        return json({ ...answerQuestion(input.question, language), ...await quota.json() });
      }
      return fail('not_found', 404);
    } catch (error) {
      // Do not leak or log request contents, email addresses or authentication material.
      return fail(error instanceof SyntaxError || error.message === 'invalid_body' ? 'invalid_body' : 'unavailable', error instanceof SyntaxError || error.message === 'invalid_body' ? 400 : 503);
    }
  },
};

export class InvestorDesk {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const input = await request.json();
    const now = Date.now();
    // A single transaction serializes check-and-increment across tabs, devices and isolates.
    const result = await this.storage.transaction(async tx => {
      const data = await tx.get('state') || { sessions: {}, requests: {}, used: 0, day: day(now) };
      if (data.day !== day(now)) { data.day = day(now); data.used = 0; data.requests = {}; data.mailCount = 0; }
      for (const [id, exp] of Object.entries(data.sessions)) if (exp <= now) delete data.sessions[id];
      let reply;
      if (path === '/rate') {
        if (data.used >= 300) return fail('mail_limit', 429);
        data.ips ||= {};
        for (const [ip, value] of Object.entries(data.ips)) if (value.until <= now) delete data.ips[ip];
        const rate = data.ips[input.ip] || { count: 0, until: now + 3600000 };
        if (rate.count >= 5) return fail('mail_limit', 429);
        rate.count++; data.ips[input.ip] = rate; data.used++;
        reply = json({ ok: true });
      } else if (path === '/prepare') {
        if ((data.mailCount || 0) >= 5 || now - (data.lastMail || 0) < 60000) return fail('mail_limit', 429);
        data.mailCount = (data.mailCount || 0) + 1; data.lastMail = now;
        data.otp = { challenge: input.challenge, hash: input.codeHash, exp: now + 600000, attempts: 0 };
        reply = json({ ok: true });
      } else if (path === '/invalidate') {
        if (data.otp?.challenge === input.challenge) delete data.otp;
        reply = json({ ok: true });
      } else if (path === '/verify') {
        const otp = data.otp;
        if (!otp || otp.exp <= now || otp.attempts >= 5 || otp.challenge !== input.challenge) return fail('invalid_code');
        otp.attempts++;
        if (otp.hash !== input.codeHash) reply = fail('invalid_code');
        else {
          delete data.otp;
          data.email = input.email;
          data.sessions[input.id] = input.exp;
          const entries = Object.entries(data.sessions).sort((a, b) => a[1] - b[1]);
          while (entries.length > 10) delete data.sessions[entries.shift()[0]];
          reply = json({ remaining: 100 - data.used, resetAt: resetAt(now) });
        }
      } else {
        if (!data.sessions[input.id]) return fail('unauthenticated', 401);
        if (path === '/logout') { delete data.sessions[input.id]; reply = json({ ok: true }); }
        else if (path === '/session') reply = json({ remaining: 100 - data.used, resetAt: resetAt(now) });
        else if (path === '/identity') reply = json({ email: data.email, remaining: 100 - data.used, resetAt: resetAt(now) });
        else if (path === '/consume') {
          const previous = data.requests[input.requestId];
          if (previous && previous !== input.fingerprint) return fail('request_conflict', 409);
          if (!previous && data.used >= 100) return fail('daily_limit', 429, { remaining: 0, resetAt: resetAt(now) });
          if (!previous) { data.used++; data.requests[input.requestId] = input.fingerprint; }
          reply = json({ remaining: 100 - data.used, resetAt: resetAt(now) });
        } else return fail('not_found', 404);
      }
      await tx.put('state', data);
      // Reads must not postpone cleanup indefinitely for continuously active accounts.
      if (await tx.getAlarm() === null) await tx.setAlarm(now + DAY);
      return reply;
    });
    return result;
  }
  async alarm() {
    await this.storage.transaction(async tx => {
      const data = await tx.get('state');
      if (!data) return;
      const now = Date.now();
      if (data.day !== day(now)) { data.day = day(now); data.used = 0; data.requests = {}; data.mailCount = 0; delete data.ips; }
      if (data.otp?.exp <= now) delete data.otp;
      for (const [id, exp] of Object.entries(data.sessions)) if (exp <= now) delete data.sessions[id];
      if (!Object.keys(data.sessions).length && !data.otp && !data.used) await tx.delete('state');
      else { await tx.put('state', data); await tx.setAlarm(now + DAY); }
    });
  }
}
