// Injects the "Present" button into YouTube's action bar

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.injectReadButton = function(onClick, captionTracks) {
  const existing = document.getElementById('ytpres-read-btn');
  if (existing) existing.remove();
  const existingLang = document.getElementById('ytpres-lang-select');
  if (existingLang) existingLang.remove();

  const button = document.createElement('button');
  button.id = 'ytpres-read-btn';
  button.className = 'ytpres-read-btn';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
      <path d="M10 8l5 4-5 4z"/>
    </svg>
    <span>Present</span>
  `;
  button.addEventListener('click', onClick);

  // Language selector dropdown
  let langSelect = null;
  if (captionTracks && captionTracks.length >= 2) {
    langSelect = document.createElement('select');
    langSelect.id = 'ytpres-lang-select';
    langSelect.className = 'ytpres-lang-select';

    // Deduplicate by languageCode, prefer non-asr
    const seen = new Map();
    for (const track of captionTracks) {
      const code = track.languageCode;
      if (!seen.has(code) || (seen.get(code).kind === 'asr' && track.kind !== 'asr')) {
        seen.set(code, track);
      }
    }

    for (const [code, track] of seen) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = track.name?.simpleText || code;
      if (code === 'en') opt.selected = true;
      langSelect.appendChild(opt);
    }
  }

  const insertButton = () => {
    // Insert as a sibling before the actions row, inside the menu-renderer
    // which is a flex container that can hold our button
    const menuRenderer = document.querySelector(
      'ytd-watch-metadata ytd-menu-renderer.ytd-watch-metadata'
    );
    if (menuRenderer) {
      menuRenderer.insertBefore(button, menuRenderer.firstChild);
      if (langSelect) menuRenderer.insertBefore(langSelect, button.nextSibling);
      return true;
    }
    // Fallback: insert before the actions flex container
    const flexContainer = document.querySelector(
      '#top-level-buttons-computed'
    );
    if (flexContainer?.parentElement) {
      flexContainer.parentElement.insertBefore(button, flexContainer);
      if (langSelect) flexContainer.parentElement.insertBefore(langSelect, button.nextSibling);
      return true;
    }
    return false;
  };

  if (!insertButton()) {
    const observer = new MutationObserver((_, obs) => {
      if (insertButton()) obs.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  return button;
};

window.YTPresenter.removeReadButton = function() {
  const btn = document.getElementById('ytpres-read-btn');
  if (btn) btn.remove();
  const lang = document.getElementById('ytpres-lang-select');
  if (lang) lang.remove();
};
