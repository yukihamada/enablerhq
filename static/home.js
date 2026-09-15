(() => {
  'use strict';

  // Japanese HTML remains the source of truth and works without JavaScript.
  const text = [...document.querySelectorAll('[data-en]')].map(node => ({
    node, ja: node.textContent, en: node.dataset.en
  }));
  const attributes = ['content', 'alt', 'aria-label'].flatMap(attribute =>
    [...document.querySelectorAll(`[data-en-${attribute}]`)].map(node => ({
      node, attribute, ja: node.getAttribute(attribute),
      en: node.getAttribute(`data-en-${attribute}`)
    }))
  );
  const languageLink = document.getElementById('language');
  const links = [...document.querySelectorAll('a[href]')]
    .filter(node => node !== languageLink)
    .map(node => ({ node, href: node.getAttribute('href') }));

  function render() {
    const current = new URL(window.location.href);
    const lang = current.searchParams.get('lang') === 'en' ? 'en' : 'ja';
    document.documentElement.lang = lang;
    for (const entry of text) entry.node.textContent = entry[lang];
    for (const entry of attributes) {
      entry.node.setAttribute(entry.attribute, entry[lang]);
    }

    // Keep filters, fragments and unrelated query parameters when changing language.
    for (const { node, href } of links) {
      const url = new URL(href, current);
      if (url.origin !== current.origin || !['http:', 'https:'].includes(url.protocol)) continue;
      url.searchParams.set('lang', lang);
      node.setAttribute('href', url.pathname + url.search + url.hash);
    }

    const next = lang === 'ja' ? 'en' : 'ja';
    current.searchParams.set('lang', next);
    languageLink.href = current.pathname + current.search + current.hash;
    languageLink.textContent = next === 'en' ? 'EN' : '日本語';
    languageLink.lang = next;
    languageLink.hreflang = next;
    languageLink.setAttribute('aria-label', next === 'en' ? 'Switch to English' : '日本語に切り替える');
    languageLink.hidden = false;
    document.querySelector('[property="og:url"]').content =
      lang === 'en' ? 'https://enablerhq.com/?lang=en' : 'https://enablerhq.com/';
  }

  languageLink.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, '', languageLink.href);
    render();
  });
  window.addEventListener('popstate', render);
  window.addEventListener('hashchange', render);
  render();
})();
