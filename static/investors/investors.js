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
}
setLanguage(new URL(location.href).searchParams.get('lang'));
toggle.addEventListener('click', () => {
  const language = document.documentElement.lang === 'ja' ? 'en' : 'ja';
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  setLanguage(language);
});
