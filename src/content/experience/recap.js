// Section recap cards — shown at chapter breaks

window.YTPresenter = window.YTPresenter || {};

(function() {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.YTPresenter.recapDuration = function(recapText, wpm) {
    const wordCount = recapText.split(/\s+/).length;
    return Math.max(2000, (wordCount / (wpm || 250)) * 60000);
  };

  window.YTPresenter.showRecap = function(container, recapText, wpm, thumbnailUrl) {
    window.YTPresenter.hideRecap(container);

    const thumbHtml = thumbnailUrl
      ? `<img class="ytpres-recap-thumb" src="${escapeHtml(thumbnailUrl)}" alt="">`
      : '';

    const el = document.createElement('div');
    el.className = 'ytpres-recap';
    el.innerHTML = `
      ${thumbHtml}
      <div class="ytpres-recap-label">So far</div>
      <div class="ytpres-recap-text">${escapeHtml(recapText)}</div>
    `;

    container.appendChild(el);

    const displayMs = window.YTPresenter.recapDuration(recapText, wpm);

    return new Promise(resolve => {
      setTimeout(() => {
        el.style.animation = 'ytpres-fade-out 0.4s ease forwards';
        setTimeout(() => { el.remove(); resolve(); }, 400);
      }, displayMs);
    });
  };

  window.YTPresenter.hideRecap = function(container) {
    const existing = container.querySelector('.ytpres-recap');
    if (existing) existing.remove();
  };
})();
