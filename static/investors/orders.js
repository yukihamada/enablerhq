'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const en = () => document.documentElement.lang === 'en';
  const text = (ja, english) => en() ? english : ja;
  const money = value => new Intl.NumberFormat(en() ? 'en' : 'ja', { style: 'currency', currency: 'JPY' }).format(value);
  let orders = [], admin = false, busy = false, pending, generation = 0, authenticated = false;
  const status = value => { $('orders-status').textContent = value; };
  const errors = {
    payments_unavailable: ['テスト決済の設定がまだ完了していません。相談は保存されています。', 'Test payments are not configured yet. Your enquiry is saved.'],
    unauthenticated: ['メール認証してください。', 'Please verify your email.'],
    forbidden: ['この操作は代表本人の認証が必要です。', 'This action requires owner authentication.'],
    order_state: ['現在の状態では実行できません。更新して見積もり・決済状況を確認してください。', 'This action is not available in the current state. Refresh to review the quote and payment status.'],
    order_limit: ['受付件数の上限です。メールでご相談ください。', 'Enquiry limit reached. Please contact us by email.'],
  };
  async function api(action = '', payload) {
    const response = await fetch(`/api/investors/orders${action}`, { method: payload ? 'POST' : 'GET', credentials: 'same-origin',
      headers: payload ? { 'content-type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(25000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'unavailable');
    return result;
  }
  async function refresh() {
    if (!authenticated) return;
    const version = generation;
    const session = await fetch('/api/investors/session', { credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
    if (!session.ok) throw new Error('unauthenticated');
    const identity = await session.json(), result = await api();
    if (version !== generation) return;
    admin = identity.admin === true; orders = result.orders; render();
    $('orders-authenticated').hidden = false; $('orders-signin').hidden = true;
  }
  async function run(action) {
    if (busy) return;
    busy = true; status(text('処理中…', 'Working…'));
    for (const button of $('services').querySelectorAll('button')) button.disabled = true;
    try { await action(); status(''); }
    catch (error) {
      status((errors[error.message] || ['処理を完了できませんでした。更新して確認するかメールでご相談ください。', 'Could not complete the request. Refresh or contact us by email.'])[en() ? 1 : 0]);
    } finally { busy = false; for (const button of $('services').querySelectorAll('button')) button.disabled = false; }
  }
  function node(tag, content) { const n = document.createElement(tag); n.textContent = content; return n; }
  function button(ja, english, action) { const b = node('button', text(ja, english)); b.type = 'button'; b.className = 'desk-link'; b.addEventListener('click', () => run(action)); return b; }
  function quoteForm(order) {
    const form = document.createElement('form'), fields = {};
    form.className = 'desk-panel';
    const definitions = [
      ['scope', '開発範囲・成果物', 'Development scope and deliverables', 'textarea', '', 2000],
      ['schedule', '納期・検収手順', 'Schedule and acceptance procedure', 'textarea', '', 500],
      ['terms', '支払い・取消・返金条件、外部実費', 'Payment, cancellation, refund terms and external costs', 'textarea', '', 2000],
      ['maintenanceScope', '保守範囲・開始条件・更新・解約条件', 'Maintenance scope, start, renewal and cancellation terms', 'textarea', '', 1000],
      ['developmentNet', '開発費（税抜・円）', 'Development net (JPY)', 'number', 300000],
      ['developmentTax', '開発の税額（円・個別確認）', 'Development tax (JPY, verify individually)', 'number', ''],
      ['maintenanceNet', '月額保守（税抜・円）', 'Monthly maintenance net (JPY)', 'number', 30000],
      ['maintenanceTax', '保守の月額税額（円・個別確認）', 'Monthly maintenance tax (JPY, verify individually)', 'number', ''],
    ];
    for (const [key, ja, english, type, value, max] of definitions) {
      const label = node('label', text(ja, english));
      const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      input.name = key; input.required = true; input.value = value; fields[key] = input;
      if (type === 'number') { input.type = 'number'; input.min = key.endsWith('Net') ? '1' : '0'; input.max = '10000000'; input.step = '1'; }
      else { input.maxLength = max; input.rows = 3; }
      label.append(input); form.append(label);
    }
    const confirm = document.createElement('input'); confirm.type = 'checkbox'; confirm.required = true;
    const label = node('label', text('代表本人として範囲・税込総額・条件を確認し、この見積もりを提示します（決済はテストのみ）。', 'As the owner, I approve the scope, tax-inclusive amounts and terms for this quote (test payments only).'));
    label.prepend(confirm); form.append(label);
    const submit = node('button', text('見積もりを承認・提示', 'Approve and present quote')); submit.className = 'button dark'; form.append(submit);
    form.addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const quote = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.type === 'number' ? Number(input.value) : input.value]));
      await api('/quote', { orderId: order.id, quote, confirm: confirm.checked }); await refresh();
    }); });
    return form;
  }
  function render() {
    $('orders-list').replaceChildren();
    for (const order of orders) {
      const article = document.createElement('article'); article.className = 'desk-answer desk-panel';
      article.append(node('h3', order.title), node('p', order.details), node('p', `ID: ${order.id}`));
      if (admin) {
        article.append(node('p', order.email), node('p', text(`通知状態：${order.notification.state}`, `Notification: ${order.notification.state}`)));
        const reply = node('a', text('返信下書きを開く', 'Draft a reply'));
        reply.href = `mailto:${encodeURIComponent(order.email)}?subject=${encodeURIComponent(`Enabler: ${order.title}`)}`; article.append(reply);
      }
      const q = order.quote;
      if (!q) {
        article.append(node('p', text('受付済み・代表の確認待ち', 'Received — awaiting owner review')));
        if (admin) article.append(quoteForm(order));
      } else {
        article.append(node('h4', text('承認済みの個別見積もり', 'Owner-approved quote')));
        for (const [ja, english, value] of [['開発範囲', 'Scope', q.scope], ['納期・検収', 'Schedule and acceptance', q.schedule], ['支払条件等', 'Terms', q.terms], ['保守条件', 'Maintenance terms', q.maintenanceScope]]) article.append(node('p', `${text(ja, english)}: ${value}`));
        for (const kind of ['development', 'maintenance']) {
          const title = kind === 'development' ? text('初期開発', 'Development') : text('月額保守', 'Monthly maintenance');
          article.append(node('p', text(`${title}：${money(q[`${kind}Net`])}＋税${money(q[`${kind}Tax`])}＝${money(q[`${kind}Net`] + q[`${kind}Tax`])}`, `${title}: ${money(q[`${kind}Net`])} + tax ${money(q[`${kind}Tax`])} = ${money(q[`${kind}Net`] + q[`${kind}Tax`])}`)));
          const state = order.payments[kind]?.state;
          const states = { pending: ['決済作成の確認待ち', 'Checkout creation pending'], open: ['支払待ち', 'Awaiting payment'], paid: ['テスト支払確認済み', 'Test payment verified'], expired: ['決済期限切れ', 'Checkout expired'] };
          if (state) article.append(node('p', states[state]?.[en() ? 1 : 0] || state));
          if (state !== 'paid' && state !== 'expired' && (kind === 'development' || order.deliveredAt)) {
            const acceptance = document.createElement('input'); acceptance.type = 'checkbox'; acceptance.required = true;
            const label = node('label', kind === 'development' ? text('上記の開発範囲・総額・支払条件を確認しました。', 'I agree to the development scope, total and payment terms above.') : text('上記の保守範囲・月額総額・毎月更新と解約条件を確認し、保守開始に同意します。', 'I agree to start maintenance under the scope, monthly total, recurring billing and cancellation terms above.'));
            label.prepend(acceptance); article.append(label);
            article.append(button('テスト決済へ', 'Open test checkout', async () => {
              if (!acceptance.checked) { acceptance.reportValidity(); throw new Error('order_state'); }
              const result = await api('/checkout', { orderId: order.id, kind, version: q.version, accept: true });
              if (!result.url?.startsWith('https://checkout.stripe.com/')) throw new Error('unavailable'); location.assign(result.url);
            }));
          }
        }
        article.append(button('支払い状況を照合', 'Verify payment status', async () => { await api('/reconcile', { orderId: order.id }); await refresh(); }));
        if (admin && order.payments.development?.state === 'paid' && !order.deliveredAt) article.append(button('テスト納品を確認・保守を提示', 'Confirm test delivery and offer maintenance', async () => {
          if (!window.confirm(text('テスト納品を確認し、別契約の保守を提示しますか？', 'Confirm test delivery and offer a separate maintenance agreement?'))) return;
          await api('/delivered', { orderId: order.id, confirm: true }); await refresh();
        }));
        if (order.payments.maintenance?.customer) article.append(button('保守の管理・解約', 'Manage or cancel maintenance', async () => {
          const result = await api('/portal', { orderId: order.id });
          if (!result.url?.startsWith('https://billing.stripe.com/')) throw new Error('unavailable'); location.assign(result.url);
        }));
      }
      $('orders-list').append(article);
    }
  }
  $('orders-create').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const title = $('order-title').value.trim(), details = $('order-details').value.trim();
    if (!pending || pending.title !== title || pending.details !== details) pending = { requestId: crypto.randomUUID(), title, details, consent: $('order-consent').checked, language: en() ? 'en' : 'ja' };
    await api('', pending); pending = null; $('orders-create').reset(); await refresh();
  }); });
  $('orders-refresh').addEventListener('click', () => run(refresh));
  document.addEventListener('desk-auth', event => {
    generation++;
    authenticated = event.detail.authenticated;
    if (event.detail.authenticated) run(refresh);
    else { orders = []; admin = false; pending = null; $('orders-authenticated').hidden = true; $('orders-signin').hidden = false; $('orders-create').reset(); render(); status(''); }
  });
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
