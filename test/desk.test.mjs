import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture } from '../tools/desk-fixture.mjs';
import { InvestorDesk, canonicalEmail } from '../desk/worker.mjs';
import { answerQuestion } from '../desk/knowledge.mjs';

async function fixture(t) {
  const f = createFixture();
  t.after(() => f.mf.dispose());
  await f.mf.ready;
  return f;
}
const question = (text = 'Senteとteaiはどう違う？') => ({ question: text, language: 'ja', requestId: randomUUID() });

test('email validation and Gmail alias quota identity', () => {
  assert.equal(canonicalEmail(' A.B+tag@googlemail.com '), 'ab@gmail.com');
  for (const email of ['', 'x\ny@example.test', '.x@example.test', 'x..y@example.test', 'x@example..test']) assert.equal(canonicalEmail(email), null);
});

test('real worker: consent, origin, authentication and input boundaries', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('ask', question())).status, 401);
  assert.equal((await f.request('auth/request', { email: 'a@example.test' })).status, 400);
  assert.equal((await f.request('auth/request', { email: 'a@example.test', consent: true }, null, { origin: 'https://other.test' })).status, 403);
  const oversized = await f.request('auth/request', { email: 'a'.repeat(9000), consent: true });
  assert.equal(oversized.status, 400);
  assert.equal(f.emails.length, 0);
});

test('real worker: one-use OTP, signed HttpOnly cookie, logout revocation', async t => {
  const f = await fixture(t);
  const { credentials, cookie, response } = await f.login();
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=604800; Secure/);
  assert.equal((await f.request('auth/verify', credentials)).status, 400);
  assert.equal((await f.request('session', undefined, cookie)).status, 200);
  assert.equal((await f.request('session', undefined, cookie.slice(0, -1))).status, 401);
  assert.equal((await f.request('logout', {}, cookie)).status, 200);
  assert.equal((await f.request('session', undefined, cookie)).status, 401);
});

test('real worker: five wrong OTP attempts lock even the correct code', async t => {
  const f = await fixture(t);
  const credentials = await f.start();
  const wrong = credentials.code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await f.request('auth/verify', { ...credentials, code: wrong })).status, 400);
  assert.equal((await f.request('auth/verify', credentials)).status, 400);
});

test('real worker: resend throttling, aliases and failed delivery invalidate OTP', async t => {
  const f = await fixture(t);
  await f.start('a.b+one@gmail.com');
  assert.equal(f.emails[0].to[0], 'ab@gmail.com');
  assert.equal((await f.request('auth/request', { email: 'ab+two@googlemail.com', consent: true })).status, 429);
  f.failMail();
  const failed = await f.request('auth/request', { email: 'other@example.test', consent: true });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'mail_unavailable' });
});

test('real worker: 110 concurrent distinct requests allow exactly 100, retries stay idempotent', async t => {
  const f = await fixture(t);
  const { cookie } = await f.login();
  const requests = Array.from({ length: 110 }, () => question());
  const responses = await Promise.all(requests.map(q => f.request('ask', q, cookie)));
  assert.equal(responses.filter(r => r.status === 200).length, 100);
  assert.equal(responses.filter(r => r.status === 429).length, 10);
  const accepted = requests[responses.findIndex(r => r.ok)];
  const retry = await f.request('ask', accepted, cookie);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).remaining, 0);
  assert.equal((await f.request('ask', { ...accepted, question: '別の質問' }, cookie)).status, 409);
  assert.equal((await f.request('session', undefined, cookie)).status, 200);
});

test('real worker: concurrent duplicates count once and one IP cannot send six codes', async t => {
  const f = await fixture(t);
  const { cookie } = await f.login();
  const q = question();
  const replies = await Promise.all(Array.from({ length: 12 }, () => f.request('ask', q, cookie)));
  assert(replies.every(r => r.ok));
  assert.equal((await (await f.request('session', undefined, cookie)).json()).remaining, 99);
  for (let i = 0; i < 6; i++) {
    const response = await f.request('auth/request', { email: `ip${i}@example.test`, consent: true }, null, { 'cf-connecting-ip': '198.51.100.10' });
    assert.equal(response.status, i < 5 ? 200 : 429);
  }
});

// Clock-controlled lifecycle tests exercise the production Durable Object class.
// Concurrency is verified separately above against the actual workerd storage engine.
function stateFixture() {
  let data, alarm = null;
  const storage = {
    async get() { return structuredClone(data); }, async put(_, value) { data = structuredClone(value); },
    async delete() { data = undefined; }, async getAlarm() { return alarm; }, async setAlarm(value) { alarm = value; },
    async transaction(fn) { return fn(storage); },
  };
  const desk = new InvestorDesk({ storage });
  return { desk, state: () => data, async call(path, body) { return desk.fetch(new Request(`https://internal${path}`, { method: 'POST', body: JSON.stringify(body) })); } };
}

test('OTP expiry, day rollover, sessions share quota and inactive retention', async t => {
  const now = Date.parse('2026-09-26T23:59:00Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  const f = stateFixture();
  await f.call('/prepare', { challenge: 'one', codeHash: 'hash' });
  await f.call('/verify', { challenge: 'one', codeHash: 'hash', id: 'first', exp: now + 7 * 86400000 });
  await f.call('/consume', { id: 'first', requestId: 'one', fingerprint: 'q1' });
  t.mock.timers.tick(60001);
  await f.call('/prepare', { challenge: 'two', codeHash: 'hash' });
  const verified = await f.call('/verify', { challenge: 'two', codeHash: 'hash', id: 'second', exp: now + 7 * 86400000 });
  assert.equal((await verified.json()).remaining, 100);
  await f.call('/consume', { id: 'second', requestId: 'two', fingerprint: 'q2' });
  assert.equal((await (await f.call('/session', { id: 'first' })).json()).remaining, 99);
  t.mock.timers.tick(60001);
  await f.call('/prepare', { challenge: 'expired', codeHash: 'hash' });
  t.mock.timers.tick(600000);
  assert.equal((await f.call('/verify', { challenge: 'expired', codeHash: 'hash', id: 'third' })).status, 400);
  t.mock.timers.tick(8 * 86400000);
  assert.equal((await f.call('/session', { id: 'first' })).status, 401);
  await f.desk.alarm();
  assert.equal(f.state(), undefined);
});

test('FAQ matches both languages and unknown questions never invent facts', () => {
  assert.deepEqual(answerQuestion('Senteとteaiはどう違う？').results.map(r => r.id), ['sente', 'teai']);
  assert.equal(answerQuestion('Are financing terms set?', 'en').results[0].id, 'terms');
  assert.match(answerQuestion('売上は？').results[0].text, /掲載していません/);
  const unknown = answerQuestion('好きな動物は？');
  assert.equal(unknown.results.length, 0);
  assert.equal(unknown.handoff, true);
  assert.equal(unknown.mode, 'reviewed-faq');
});

test('daily mail cap, failed-code invalidation and global mail cap', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-26T10:00:00Z') });
  const f = stateFixture();
  for (let i = 0; i < 5; i++) {
    assert.equal((await f.call('/prepare', { challenge: `c${i}`, codeHash: 'hash' })).status, 200);
    t.mock.timers.tick(60001);
  }
  assert.equal((await f.call('/prepare', { challenge: 'six', codeHash: 'hash' })).status, 429);
  await f.call('/invalidate', { challenge: 'c4' });
  assert.equal((await f.call('/verify', { challenge: 'c4', codeHash: 'hash', id: 'session' })).status, 400);
  const guard = stateFixture();
  for (let i = 0; i < 300; i++) assert.equal((await guard.call('/rate', { ip: `hash-${i}` })).status, 200);
  assert.equal((await guard.call('/rate', { ip: 'new-hash' })).status, 429);
  t.mock.timers.tick(86400000);
  assert.equal((await guard.call('/rate', { ip: 'new-hash' })).status, 200);
});
