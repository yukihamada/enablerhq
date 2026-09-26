'use strict';
const nodes = [...document.querySelectorAll('[data-en]')];
const japanese = new Map(nodes.map(node => [node, node.innerHTML]));
const toggle = document.getElementById('language');
function setLanguage(language) {
  const english = language === 'en';
  document.documentElement.lang = english ? 'en' : 'ja';
  for (const node of nodes) {
    if (english) node.textContent = node.dataset.en;
    else node.innerHTML = japanese.get(node);
  }
  document.title = english ? 'Enabler — Business, investment & development' : 'Enabler — 事業紹介・投資と開発のご相談';
  document.querySelector('meta[name="description"]').content = english
    ? 'Explore Enabler Inc., Sente and teai, their business models, information for investment discussions, and software development and maintenance enquiries.'
    : '株式会社イネブラの事業紹介。Sente・teaiの製品と収益モデル、投資検討のための公開情報、開発・保守の相談窓口。';
  toggle.textContent = english ? '日本語 ↗' : 'EN ↗';
  toggle.setAttribute('aria-label', english ? '日本語に切り替え' : 'Switch to English');
  const subject = english ? 'Investment / partnership conversation with Enabler' : 'イネブラへの出資・事業連携のご相談';
  const body = english ? 'Name / company:\nArea of interest:\nInformation requested (metrics / period):\nPreferred timing:\n' : 'お名前・会社名：\n関心領域：\n確認したい情報（指標・期間）：\n希望時期：\n';
  document.getElementById('contact-mail').href = `mailto:mail@yukihamada.jp?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  for (const link of document.querySelectorAll('[data-mail="development"]')) {
    const subject = english ? 'Software development and maintenance enquiry' : '開発・保守の相談';
    const body = english ? 'Name / company:\nGoal:\nCurrent workflow:\nPreferred timing:\nApproximate budget (JPY):\nMaintenance needs:\n' : 'お名前・会社名：\n実現したいこと：\n現在の業務：\n希望時期：\n予算目安（円）：\n保守の希望：\n';
    link.href = `mailto:mail@yukihamada.jp?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  document.dispatchEvent(new CustomEvent('investor-language'));
}
setLanguage(new URL(location.href).searchParams.get('lang'));
toggle.addEventListener('click', () => {
  const language = document.documentElement.lang === 'ja' ? 'en' : 'ja';
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  setLanguage(language);
});

(() => {
  const $ = id => document.getElementById(id);
  const kind = $('enquiry-kind');
  const draft = $('enquiry-draft');
  const drafts = new Map();
  const text = (ja, en) => document.documentElement.lang === 'en' ? en : ja;
  const template = () => new URL((kind.value === 'development'
    ? document.querySelector('[data-mail="development"]') : $('contact-mail')).href);
  function render() {
    const url = template();
    const value = drafts.get(kind.value) ?? url.searchParams.get('body');
    if (draft.value !== value) draft.value = value;
    url.searchParams.set('body', draft.value);
    // Long mailto URLs are inconsistently handled by mail clients. Copy remains available.
    $('enquiry-open').hidden = url.href.length > 1800;
    $('enquiry-open').href = url.href;
    $('enquiry-status').textContent = url.href.length > 1800
      ? text('長い相談文はコピーしてWebメールに貼り付けてください。', 'For a long draft, copy and paste it into webmail.') : '';
    $('enquiry-manual').hidden = true;
  }
  draft.addEventListener('input', () => { drafts.set(kind.value, draft.value); render(); });
  kind.addEventListener('change', render);
  document.addEventListener('investor-language', render);
  $('enquiry-development').addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); kind.value = 'development'; render();
    location.hash = 'contact'; draft.focus({ preventScroll: true });
  });
  $('enquiry-copy').addEventListener('click', async () => {
    const url = template();
    const content = `${text('宛先', 'To')}: mail@yukihamada.jp\n${text('件名', 'Subject')}: ${url.searchParams.get('subject')}\n\n${draft.value}`;
    const button = $('enquiry-copy'); button.disabled = true;
    try {
      await navigator.clipboard.writeText(content);
      $('enquiry-status').textContent = text('コピーしました。Webメールに貼り付け、確認して送信してください。まだ送信されていません。', 'Copied. Paste into webmail, review and send. Nothing has been sent yet.');
    } catch {
      $('enquiry-manual').hidden = false;
      $('enquiry-copy-text').value = content;
      $('enquiry-copy-text').focus(); $('enquiry-copy-text').select();
      $('enquiry-status').textContent = text('自動コピーを利用できません。下の選択済みテキストを手動でコピーしてください。', 'Automatic copying is unavailable. Copy the selected text below manually.');
    } finally { button.disabled = false; }
  });
  $('enquiry-composer').hidden = false;
  $('enquiry-development').hidden = false;
  render();
})();
