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
  document.title = english ? 'Enabler — Investor preview' : 'Enabler — 投資家向けプレビュー';
  document.querySelector('meta[name="description"]').content = english
    ? 'An investor conversation draft for Enabler Inc. Explore Sente, teai, the business model and proposed validation priorities.'
    : '株式会社イネブラの事業と投資家向け対話のためのプレビュー。Senteとteaiの現在地、事業モデル、次の検証をご紹介します。';
  toggle.textContent = english ? '日本語 ↗' : 'EN ↗';
  toggle.setAttribute('aria-label', english ? '日本語に切り替え' : 'Switch to English');
  const subject = english ? 'Investment / partnership conversation with Enabler' : 'イネブラへの出資・事業連携のご相談';
  document.getElementById('contact-mail').href = `mailto:mail@yukihamada.jp?subject=${encodeURIComponent(subject)}`;
}
setLanguage(new URL(location.href).searchParams.get('lang'));
toggle.addEventListener('click', () => {
  const language = document.documentElement.lang === 'ja' ? 'en' : 'ja';
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  setLanguage(language);
});
