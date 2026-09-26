const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
const fail = (error, status = 400) => json({ error }, status);
const validId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const money = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000000;

async function stripe(env, path, params, key) {
  // This release can only use Stripe test mode. Live billing requires a separate release decision.
  if (!/^(sk|rk)_test_/.test(env.STRIPE_TEST_SECRET_KEY || '')) throw new Error('payments_unavailable');
  const response = await (env.STRIPE ? env.STRIPE.fetch.bind(env.STRIPE) : fetch)(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${env.STRIPE_TEST_SECRET_KEY}`, ...(params ? { 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': key } : {}) },
    body: params ? new URLSearchParams(params).toString() : undefined, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('payments_unavailable');
  return response.json();
}

export class OrderDesk {
  constructor(state, env) { this.storage = state.storage; this.env = env; }
  async fetch(request) {
    const input = await request.json();
    const path = new URL(request.url).pathname;
    try {
      if (path === '/create') return await this.create(input);
      if (path === '/list') {
        const rows = [...(await this.storage.list({ prefix: 'order:' })).values()];
        return json({ orders: rows.filter(o => input.admin || o.owner === input.owner).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), testMode: true });
      }
      if (!validId(input.orderId)) return fail('order_invalid');
      const order = await this.storage.get(`order:${input.orderId}`);
      if (!order || (!input.admin && order.owner !== input.owner)) return fail('not_found', 404);
      if (path === '/quote' || path === '/delivered') {
        if (!input.admin || input.confirm !== true) return fail('forbidden', 403);
        return this.storage.transaction(async tx => {
          const current = await tx.get(`order:${input.orderId}`);
          if (path === '/quote') {
            if (current.quote) return fail('order_state', 409);
            const q = input.quote;
            if (!q || !text(q.scope, 2000) || !text(q.schedule, 500) || !text(q.terms, 2000) || !text(q.maintenanceScope, 1000)
              || ![q.developmentNet, q.developmentTax, q.maintenanceNet, q.maintenanceTax].every(money)
              || q.developmentNet < 1 || q.maintenanceNet < 1) return fail('quote_invalid');
            current.quote = { scope: q.scope.trim(), schedule: q.schedule.trim(), terms: q.terms.trim(), maintenanceScope: q.maintenanceScope.trim(),
              developmentNet: q.developmentNet, developmentTax: q.developmentTax, maintenanceNet: q.maintenanceNet, maintenanceTax: q.maintenanceTax,
              currency: 'jpy', approvedAt: new Date().toISOString(), approvedBy: input.email, version: crypto.randomUUID() };
          } else {
            if (current.payments?.development?.state !== 'paid') return fail('order_state', 409);
            current.deliveredAt ||= new Date().toISOString();
          }
          await tx.put(`order:${current.id}`, current);
          return json({ order: current });
        });
      }
      if (path === '/checkout' && order.owner !== input.owner) return fail('forbidden', 403);
      if (path === '/checkout') return await this.checkout(input);
      if (path === '/reconcile') return json({ order: await this.reconcile(order) });
      if (path === '/portal') {
        if (order.owner !== input.owner) return fail('forbidden', 403);
        const customer = order.payments?.maintenance?.customer;
        if (!customer) return fail('order_state', 409);
        const portal = await stripe(this.env, 'billing_portal/sessions', { customer, return_url: `${this.env.ALLOWED_ORIGIN}/investors/#services` }, crypto.randomUUID());
        if (!portal.url?.startsWith('https://billing.stripe.com/')) return fail('payments_unavailable', 503);
        return json({ url: portal.url });
      }
      return fail('not_found', 404);
    } catch (error) {
      return fail(error.message === 'payments_unavailable' ? error.message : 'unavailable', 503);
    }
  }
  async create(input) {
    if (!validId(input.requestId) || !text(input.title, 120) || !text(input.details, 3000) || input.consent !== true) return fail('order_invalid');
    return this.storage.transaction(async tx => {
      const key = `request:${input.owner}:${input.requestId}`;
      const previous = await tx.get(key);
      if (previous) {
        const order = await tx.get(`order:${previous}`);
        return order.title === input.title.trim() && order.details === input.details.trim() ? json({ order }) : fail('request_conflict', 409);
      }
      const rows = await tx.list({ prefix: 'order:' });
      if (rows.size >= 1000 || [...rows.values()].filter(o => o.owner === input.owner).length >= 10) return fail('order_limit', 429);
      const order = { id: crypto.randomUUID(), owner: input.owner, email: input.email, title: input.title.trim(), details: input.details.trim(),
        language: input.language === 'en' ? 'en' : 'ja', createdAt: new Date().toISOString(), notification: { state: 'pending', attempts: 0 }, payments: {} };
      await tx.put(`order:${order.id}`, order); await tx.put(key, order.id);
      if (await tx.getAlarm() === null) await tx.setAlarm(Date.now() + 1000);
      return json({ order }, 201);
    });
  }
  async checkout(input) {
    if (!['development', 'maintenance'].includes(input.kind) || input.accept !== true) return fail('order_invalid');
    if (!/^(sk|rk)_test_/.test(this.env.STRIPE_TEST_SECRET_KEY || '')) return fail('payments_unavailable', 503);
    const reserved = await this.storage.transaction(async tx => {
      const order = await tx.get(`order:${input.orderId}`);
      if (!order.quote || input.version !== order.quote.version || (input.kind === 'maintenance' && !order.deliveredAt)) return null;
      let payment = order.payments[input.kind];
      if (!payment) {
        payment = order.payments[input.kind] = { state: 'pending', acceptedAt: new Date().toISOString(), acceptedBy: input.email,
          key: `enabler-${order.id}-${input.kind}-${order.quote.version}`, reservedAt: Date.now() };
        await tx.put(`order:${order.id}`, order);
      }
      return order;
    });
    if (!reserved) return fail('order_state', 409);
    const payment = reserved.payments[input.kind];
    if (payment.sessionId) {
      const updated = await this.reconcile(reserved);
      if (updated.payments[input.kind].state !== 'open') return fail('order_state', 409);
      return json({ url: payment.url, testMode: true });
    }
    // Stripe idempotency keys expire after 24h. Never risk a second checkout after an ambiguous timeout.
    if (Date.now() - payment.reservedAt > 23 * 3600000) return fail('checkout_review_required', 409);
    const q = reserved.quote, kind = input.kind;
    const params = {
      mode: kind === 'development' ? 'payment' : 'subscription', customer_email: reserved.email,
      success_url: `${this.env.ALLOWED_ORIGIN}/investors/?payment=return#services`, cancel_url: `${this.env.ALLOWED_ORIGIN}/investors/#services`,
      client_reference_id: reserved.id, 'metadata[order_id]': reserved.id, 'metadata[kind]': kind, 'metadata[quote_version]': q.version,
      'line_items[0][price_data][currency]': 'jpy', 'line_items[0][price_data][unit_amount]': String(q[`${kind}Net`] + q[`${kind}Tax`]),
      'line_items[0][price_data][product_data][name]': `Enabler ${kind} — ${reserved.id}`,
      'line_items[0][quantity]': '1', expires_at: String(Math.floor(payment.reservedAt / 1000) + 3600),
      ...(kind === 'maintenance' ? { 'line_items[0][price_data][recurring][interval]': 'month' } : {}),
    };
    const checkout = await stripe(this.env, 'checkout/sessions', params, payment.key);
    if (checkout.livemode !== false || !/^cs_test_[a-zA-Z0-9]+$/.test(checkout.id) || !checkout.url?.startsWith('https://checkout.stripe.com/')) throw new Error('payments_unavailable');
    await this.storage.transaction(async tx => {
      const current = await tx.get(`order:${reserved.id}`);
      current.payments[kind] = { ...current.payments[kind], sessionId: checkout.id, url: checkout.url, state: current.payments[kind].state === 'pending' ? 'open' : current.payments[kind].state };
      await tx.put(`order:${current.id}`, current);
    });
    return json({ url: checkout.url, testMode: true });
  }
  async reconcile(order) {
    for (const kind of ['development', 'maintenance']) {
      const p = order.payments[kind];
      if (!p?.sessionId || p.state === 'paid') continue;
      const checkout = await stripe(this.env, `checkout/sessions/${encodeURIComponent(p.sessionId)}`);
      if (checkout.livemode !== false || checkout.id !== p.sessionId || checkout.metadata?.order_id !== order.id || checkout.metadata?.kind !== kind
        || checkout.metadata?.quote_version !== order.quote.version || checkout.currency !== 'jpy'
        || checkout.mode !== (kind === 'development' ? 'payment' : 'subscription')
        || checkout.amount_total !== order.quote[`${kind}Net`] + order.quote[`${kind}Tax`]) throw new Error('payments_unavailable');
      await this.storage.transaction(async tx => {
        const current = await tx.get(`order:${order.id}`), currentPayment = current.payments[kind];
        if (currentPayment.state === 'paid') return;
        if (checkout.status === 'complete' && checkout.payment_status === 'paid') {
          currentPayment.state = 'paid'; currentPayment.paidAt = new Date().toISOString();
          currentPayment.customer = checkout.customer; currentPayment.subscription = checkout.subscription;
        } else if (checkout.status === 'expired') currentPayment.state = 'expired';
        await tx.put(`order:${order.id}`, current);
      });
    }
    return this.storage.get(`order:${order.id}`);
  }
  async alarm() {
    const orders = await this.storage.list({ prefix: 'order:' });
    let pending = false;
    for (const order of orders.values()) {
      if (order.notification.state !== 'pending') continue;
      let sent = false;
      try {
        if (!this.env.RESEND_API_KEY || !this.env.OWNER_EMAIL || !this.env.MAIL_FROM) throw new Error('mail_unavailable');
        const request = new Request('https://api.resend.com/emails', { method: 'POST',
          headers: { authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': `enabler-order-${order.id}` },
          body: JSON.stringify({ from: this.env.MAIL_FROM, to: [this.env.OWNER_EMAIL], subject: 'Enabler：開発相談を受け付けました / New enquiry',
            text: `受付ID / Enquiry ID: ${order.id}\n${this.env.ALLOWED_ORIGIN}/investors/#services\n\n本人のメールで認証して相談を確認してください。返信・見積もり・着手は人が確認して進めます。\nSign in with the owner email to review. No quote, charge or work has been authorized by this enquiry.` }),
          signal: AbortSignal.timeout(10000) });
        const response = await (this.env.MAILER ? this.env.MAILER.fetch(request) : fetch(request)); sent = response.ok;
      } catch { sent = false; }
      await this.storage.transaction(async tx => {
        const current = await tx.get(`order:${order.id}`);
        current.notification.attempts++;
        current.notification.state = sent ? 'sent' : current.notification.attempts >= 10 ? 'failed' : 'pending';
        pending ||= current.notification.state === 'pending';
        await tx.put(`order:${order.id}`, current);
      });
    }
    if (pending) await this.storage.setAlarm(Date.now() + 60000);
  }
}
