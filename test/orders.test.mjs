import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture } from '../tools/desk-fixture.mjs';
import { OrderDesk } from '../desk/orders.mjs';

const enquiry = () => ({ requestId: randomUUID(), title: 'Work enquiry', details: 'Build an internal scheduling tool.', consent: true });
const quote = { scope: 'Scheduling page and tests', schedule: 'Two weeks, then acceptance review', terms: 'Test only; no work begins. Refund and cancellation by written agreement. External costs excluded.', maintenanceScope: 'Two hours monthly. Monthly renewal. Cancel before renewal using the portal or email.', developmentNet: 300000, developmentTax: 30000, maintenanceNet: 30000, maintenanceTax: 3000 };
async function fixture(t, options) {
  const f = createFixture(undefined, options); t.after(() => f.mf.dispose()); await f.mf.ready; return f;
}
async function create(f, cookie, input = enquiry()) {
  const response = await f.request('orders', input, cookie);
  assert(response.ok, await response.clone().text()); return (await response.json()).order;
}

test('enquiry ownership, forged role/email rejection, consent, idempotency and revocation', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('orders', enquiry())).status, 401);
  const user = await f.login(), other = await f.login('other@example.test');
  assert.equal((await f.request('orders', { ...enquiry(), consent: false }, user.cookie)).status, 400);
  const input = { ...enquiry(), admin: true, owner: 'forged', email: 'owner@example.test' };
  const results = await Promise.all(Array.from({ length: 8 }, () => create(f, user.cookie, input)));
  assert.equal(new Set(results.map(o => o.id)).size, 1);
  const order = results[0]; assert.equal(order.email, 'visitor@example.test'); assert.notEqual(order.owner, 'forged');
  assert.equal((await f.request('orders', { ...input, title: 'Changed' }, user.cookie)).status, 409);
  assert.deepEqual((await (await f.request('orders', undefined, other.cookie)).json()).orders, []);
  assert.equal((await f.request('orders/quote', { orderId: order.id, quote, confirm: true, admin: true }, user.cookie)).status, 403);
  assert.equal((await f.request('orders/reconcile', { orderId: order.id }, other.cookie)).status, 404);
  await f.request('logout', {}, user.cookie);
  assert.equal((await f.request('orders', undefined, user.cookie)).status, 401);
});

test('owner approval required, immutable quotes, missing/live keys fail closed, maintenance gated on delivery', async t => {
  for (const key of ['', 'sk_live_test']) {
    const f = await fixture(t, { bindings: { STRIPE_TEST_SECRET_KEY: key } });
    const user = await f.login(), owner = await f.login('owner@example.test');
    const order = await create(f, user.cookie);
    assert.equal((await f.request('session', undefined, owner.cookie).then(r => r.json())).admin, true);
    assert.equal((await f.request('orders/quote', { orderId: order.id, quote }, owner.cookie)).status, 403);
    assert.equal((await f.request('orders/quote', { orderId: order.id, quote: { ...quote, developmentNet: -1 }, confirm: true }, owner.cookie)).status, 400);
    const approved = await f.request('orders/quote', { orderId: order.id, quote, confirm: true }, owner.cookie);
    assert.equal(approved.status, 200);
    const q = (await approved.json()).order.quote;
    assert.equal(q.approvedBy, 'owner@example.test');
    assert.equal((await f.request('orders/quote', { orderId: order.id, quote, confirm: true }, owner.cookie)).status, 409);
    assert.equal((await f.request('orders/checkout', { orderId: order.id, kind: 'development', version: q.version, accept: true }, user.cookie)).status, 503);
    assert.equal((await f.request('orders/delivered', { orderId: order.id, confirm: true }, owner.cookie)).status, 409);
  }
});

test('Stripe contract: concurrent checkout is idempotent, server-verified payment, separate maintenance and portal', async t => {
  const sessions = new Map(), byKey = new Map(); let creations = 0, paid = false, tamper = false;
  const f = await fixture(t, { bindings: { STRIPE_TEST_SECRET_KEY: 'sk_test_fixture' }, stripe: async request => {
    const path = new URL(request.url).pathname;
    if (path === '/v1/billing_portal/sessions') return Response.json({ url: 'https://billing.stripe.com/test/fixture' });
    if (request.method === 'POST') {
      const key = request.headers.get('idempotency-key');
      if (byKey.has(key)) return Response.json(byKey.get(key));
      const params = new URLSearchParams(await request.text());
      const id = `cs_test_fixture${++creations}`;
      const checkout = { id, livemode: false, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', payment_status: 'unpaid', currency: 'jpy',
        amount_total: Number(params.get('line_items[0][price_data][unit_amount]')), mode: params.get('mode'), customer: 'cus_fixture', subscription: params.get('mode') === 'subscription' ? 'sub_fixture' : null,
        metadata: { order_id: params.get('metadata[order_id]'), kind: params.get('metadata[kind]'), quote_version: params.get('metadata[quote_version]') } };
      if (checkout.mode === 'subscription') assert.equal(params.get('line_items[0][price_data][recurring][interval]'), 'month');
      assert.equal(params.get('customer_email'), 'visitor@example.test');
      sessions.set(id, checkout); byKey.set(key, checkout); return Response.json(checkout);
    }
    const checkout = sessions.get(path.split('/').at(-1));
    return Response.json({ ...checkout, status: paid ? 'complete' : 'open', payment_status: paid ? 'paid' : 'unpaid', amount_total: checkout.amount_total + (tamper ? 1 : 0) });
  } });
  const user = await f.login(), owner = await f.login('owner@example.test'), order = await create(f, user.cookie);
  const approved = await (await f.request('orders/quote', { orderId: order.id, quote, confirm: true }, owner.cookie)).json();
  const input = { orderId: order.id, kind: 'development', version: approved.order.quote.version, accept: true };
  assert.equal((await f.request('orders/checkout', input, owner.cookie)).status, 403);
  assert.equal((await f.request('orders/checkout', { ...input, version: 'stale' }, user.cookie)).status, 409);
  assert.equal((await f.request('orders/checkout', { ...input, accept: false }, user.cookie)).status, 400);
  assert.equal((await f.request('orders/checkout', { ...input, kind: 'maintenance' }, user.cookie)).status, 409);
  const checkouts = await Promise.all(Array.from({ length: 10 }, () => f.request('orders/checkout', input, user.cookie)));
  assert(checkouts.every(r => r.ok)); assert.equal(creations, 1);
  let state = await (await f.request('orders/reconcile', { orderId: order.id, paid: true }, user.cookie)).json();
  assert.equal(state.order.payments.development.state, 'open');
  paid = true; tamper = true;
  assert.equal((await f.request('orders/reconcile', { orderId: order.id }, user.cookie)).status, 503);
  tamper = false;
  state = await (await f.request('orders/reconcile', { orderId: order.id }, user.cookie)).json();
  assert.equal(state.order.payments.development.state, 'paid');
  assert.equal((await f.request('orders/checkout', input, user.cookie)).status, 409);
  assert.equal((await f.request('orders/delivered', { orderId: order.id, confirm: true }, user.cookie)).status, 403);
  assert.equal((await f.request('orders/delivered', { orderId: order.id, confirm: true }, owner.cookie)).status, 200);
  assert.equal((await f.request('orders/checkout', { ...input, kind: 'maintenance' }, user.cookie)).status, 200);
  state = await (await f.request('orders/reconcile', { orderId: order.id }, user.cookie)).json();
  assert.equal(state.order.payments.maintenance.state, 'paid'); assert.equal(creations, 2);
  assert.equal((await f.request('orders/portal', { orderId: order.id }, user.cookie)).status, 200);
});

test('notification retries preserve enquiry and exclude customer content; exhausted retries remain visible', async () => {
  const records = new Map(); let alarm = null, fail = true, sent;
  const storage = { async get(k) { return structuredClone(records.get(k)); }, async put(k, v) { records.set(k, structuredClone(v)); },
    async list({ prefix }) { return new Map([...records].filter(([k]) => k.startsWith(prefix))); }, async getAlarm() { return alarm; }, async setAlarm(v) { alarm = v; }, async transaction(fn) { return fn(storage); } };
  const desk = new OrderDesk({ storage }, { RESEND_API_KEY: 'fake', OWNER_EMAIL: 'owner@example.test', MAIL_FROM: 'test@example.test', ALLOWED_ORIGIN: 'https://enablerhq.com',
    MAILER: { async fetch(request) { sent = await request.json(); return new Response('', { status: fail ? 503 : 200 }); } } });
  const order = (await (await desk.create({ ...enquiry(), owner: 'user', email: 'visitor@example.test' })).json()).order;
  await desk.alarm();
  assert.equal(records.get(`order:${order.id}`).notification.state, 'pending');
  assert.equal(records.get(`order:${order.id}`).notification.attempts, 1); assert(alarm > Date.now());
  fail = false; await desk.alarm();
  assert.equal(records.get(`order:${order.id}`).notification.state, 'sent');
  assert.deepEqual(sent.to, ['owner@example.test']); assert(!sent.text.includes(order.details)); assert(!sent.text.includes(order.email));
  const second = (await (await desk.create({ ...enquiry(), owner: 'user', email: 'visitor@example.test' })).json()).order;
  fail = true;
  for (let i = 0; i < 10; i++) await desk.alarm();
  assert.equal(records.get(`order:${second.id}`).notification.state, 'failed');
  assert.equal(records.get(`order:${second.id}`).details, second.details);
});
