'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const en = () => document.documentElement.lang === 'en';
  const text = (ja, english) => en() ? english : ja;
  let challenge, email, quota, pending, busy = false, authenticated = false;
  let status = null, available = false, availabilityChecked = false;
  function renderAvailability() {
    $('desk-online').hidden = !available;
    $('desk-availability').textContent = available
      ? text('オンライン窓口に接続できました。FAQ検索はメール認証後、1日100回まで（UTC 0時リセット）です。', 'Online desk connected. FAQ search allows 100 questions per day after email verification, resetting at 00:00 UTC.')
      : availabilityChecked ? text('オンライン窓口は準備中です。登録不要のメールでご相談ください。', 'The online desk is being prepared. Please enquire by email; no registration is needed.')
      : text('オンライン窓口の接続状況を確認しています。メールでの相談はいつでも利用できます。', 'Checking online desk availability. You can enquire by email at any time.');
    $('orders-signin').hidden = !available || authenticated;
  }
  const answers = [];
  const messages = {
    unavailable: ['窓口を利用できません。時間をおいて再度お試しいただくか、下のメールでご相談ください。', 'The desk is unavailable. Please try later or contact us by email below.'],
    mail_unavailable: ['認証メールを送れませんでした。時間をおいて再度お試しください。', 'We could not send the verification email. Please try again later.'],
    mail_limit: ['認証メールの送信上限です。再送は60秒以上あけてください。1アドレス1日5回までです。', 'Verification email limit reached. Wait at least 60 seconds between requests; up to 5 per address per day.'],
    invalid_code: ['コードが違うか、有効期限切れです。5回失敗すると再発行が必要です。', 'The code is incorrect or expired. After 5 failed attempts, request a new code.'],
    daily_limit: ['今日の100回を使い切りました。表示のリセット時刻以降にご利用ください。', 'You have used today’s 100 questions. Please return after the reset time shown.'],
    unauthenticated: ['ログインの有効期限が切れました。もう一度メール認証してください。', 'Your sign-in expired. Please verify your email again.'],
    email: ['メールアドレスを確認してください。', 'Please check your email address.'],
    question: ['1〜1,200文字で質問を入力してください。', 'Please enter a question of 1–1,200 characters.'],
    request_conflict: ['質問の再送を確認できませんでした。もう一度送信してください。', 'Could not verify the retry. Please send the question again.'],
    sent: ['認証メールを送りました。6桁のコードを入力してください。', 'Verification email sent. Enter the 6-digit code.'],
    verified: ['認証できました。質問を入力してください。', 'Email verified. Ask your question.'],
    selected: ['質問を選びました。メール認証後、そのまま質問できます。', 'Question selected. Verify your email to ask it.'],
    working: ['処理中…', 'Working…'],
    signedOut: ['ログアウトしました。', 'Signed out.'],
  };
  const samples = {
    products: ['Senteとteaiはどう違う？', 'How are Sente and teai different?'],
    terms: ['調達条件は決まっている？', 'Are financing terms set?'],
    plan: ['資金の使い道は？', 'What are the proposed priorities?'],
  };
  function showStatus(key) {
    status = key;
    $('desk-status').textContent = key ? (messages[key] || messages.unavailable)[en() ? 1 : 0] : '';
  }
  function renderQuota() {
    if (!quota) return;
    const time = new Intl.DateTimeFormat(en() ? 'en' : 'ja', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(quota.resetAt));
    $('desk-quota').textContent = text(`あと${quota.remaining} / 100回 · リセット ${time}`, `${quota.remaining} / 100 left · Resets ${time}`);
  }
  function setAuth(value) {
    authenticated = value;
    renderAvailability();
    $('desk-register').hidden = value;
    $('desk-verify').hidden = true;
    $('desk-authenticated').hidden = !value;
    document.dispatchEvent(new CustomEvent('desk-auth', { detail: { authenticated: value } }));
  }
  async function api(path, payload) {
    const response = await fetch(`/api/investors/${path}`, { method: payload ? 'POST' : 'GET', credentials: 'same-origin', headers: payload ? { 'content-type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(15000) });
    let data;
    try { data = await response.json(); } catch { throw new Error('unavailable'); }
    if (!response.ok) {
      if (data.resetAt) { quota = data; renderQuota(); }
      if (data.error === 'unauthenticated') setAuth(false);
      throw new Error(data.error || 'unavailable');
    }
    return data;
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    $('desk').setAttribute('aria-busy', 'true');
    for (const button of $('desk').querySelectorAll('button')) button.disabled = true;
    showStatus('working');
    try { await task(); }
    catch (error) { showStatus(error.message); }
    finally {
      busy = false;
      $('desk').removeAttribute('aria-busy');
      for (const button of $('desk').querySelectorAll('button')) button.disabled = false;
    }
  }
  $('desk-register').addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      email = $('desk-email').value.trim();
      const data = await api('auth/request', { email, consent: $('desk-consent').checked, language: en() ? 'en' : 'ja' });
      challenge = data.challenge;
      $('desk-register').hidden = true;
      $('desk-verify').hidden = false;
      $('desk-code').value = '';
      $('desk-code').focus();
      showStatus('sent');
      // Only the loopback preview server can supply a fake code. Production never returns it.
      if (location.hostname === '127.0.0.1' && data.previewCode) $('desk-status').textContent = `LOCAL DEMO · ${data.previewCode}`;
    });
  });
  $('desk-verify').addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      quota = await api('auth/verify', { email, challenge, code: $('desk-code').value });
      $('desk-email').value = ''; $('desk-code').value = ''; email = null; challenge = null;
      setAuth(true); renderQuota(); showStatus('verified'); $('desk-question').focus();
    });
  });
  $('desk-restart').addEventListener('click', () => { challenge = null; setAuth(false); showStatus(null); });
  $('desk-logout').addEventListener('click', () => run(async () => {
    await api('logout', {}); setAuth(false); quota = null; pending = null;
    answers.length = 0; $('desk-answers').replaceChildren(); $('desk-question').value = '';
    showStatus('signedOut');
  }));
  function renderAnswers() {
    $('desk-answers').replaceChildren();
    for (const { question, data } of answers) {
      const article = document.createElement('article'); article.className = 'desk-answer';
      const heading = document.createElement('h3'); heading.textContent = question; article.append(heading);
      const note = document.createElement('p'); note.textContent = data.note; article.append(note);
      for (const result of data.results) {
        const title = document.createElement('h4'); title.textContent = result.title;
        const content = document.createElement('p'); content.textContent = result.text;
        const source = document.createElement('a'); source.href = result.source;
        source.textContent = text(`出典：${result.title} ↗`, `Source: ${result.title} ↗`);
        article.append(title, content, source);
      }
      const checked = document.createElement('p'); checked.className = 'muted'; checked.textContent = text(`情報確認日：${data.checkedAt}`, `Information reviewed: ${data.checkedAt}`); article.append(checked);
      const contact = document.createElement('a'); contact.className = 'desk-handoff';
      contact.href = `mailto:mail@yukihamada.jp?subject=${encodeURIComponent(text('イネブラへのご相談', 'Enabler enquiry'))}&body=${encodeURIComponent(question)}`;
      contact.textContent = text('この質問を代表に相談する ↗', 'Ask the founder about this ↗'); article.append(contact);
      $('desk-answers').append(article);
    }
  }
  $('desk-question-form').addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      const question = $('desk-question').value.trim();
      const language = en() ? 'en' : 'ja';
      if (!pending || pending.question !== question || pending.language !== language) pending = { question, language, requestId: crypto.randomUUID() };
      const data = await api('ask', pending);
      pending = null; quota = data; renderQuota();
      answers.unshift({ question, data }); if (answers.length > 10) answers.pop();
      renderAnswers(); $('desk-question').value = ''; showStatus(null);
    });
  });
  for (const button of document.querySelectorAll('[data-question]')) button.addEventListener('click', () => {
    $('desk-question').value = samples[button.dataset.question][en() ? 1 : 0];
    if (authenticated) $('desk-question').focus(); else { showStatus('selected'); $('desk-email').focus(); }
  });
  new MutationObserver(() => { renderQuota(); showStatus(status); renderAnswers(); renderAvailability(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  (async () => {
    renderAvailability();
    try { quota = await api('session'); available = true; setAuth(true); renderQuota(); }
    catch (error) { available = error.message === 'unauthenticated'; }
    availabilityChecked = true;
    renderAvailability();
    if (location.hostname === '127.0.0.1') {
      try {
        const response = await fetch('/__desk-preview');
        if (response.ok && (await response.json()).preview === true) { $('desk-preview').hidden = false; $('desk-email').value = 'preview@example.test'; }
      } catch { /* A normal local static preview has no demo service. */ }
    }
  })();
})();
