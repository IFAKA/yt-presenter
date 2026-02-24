// Section recap cards — shown at chapter breaks

window.YTPresenter = window.YTPresenter || {};

(function() {
  const escapeHtml = window.YTPresenter.escapeHtml;

  window.YTPresenter.recapDuration = function(recapText, wpm) {
    const wordCount = recapText.split(/\s+/).length;
    return Math.max(2000, (wordCount / (wpm || 250)) * 60000);
  };

  window.YTPresenter.showRecap = function(container, recapText, wpm, thumbnail) {
    window.YTPresenter.hideRecap(container);

    let thumbHtml = '';
    if (thumbnail) {
      if (typeof thumbnail === 'string') {
        thumbHtml = `<img class="ytpres-recap-thumb" src="${escapeHtml(thumbnail)}" alt="">`;
      } else if (thumbnail.url) {
        // Storyboard sprite: use a div with background-position instead of img
        const s = thumbnail.sprite;
        thumbHtml = `<div class="ytpres-recap-thumb" style="background-image: url(${escapeHtml(thumbnail.url)}); background-position: -${s.x}px -${s.y}px; background-size: ${s.sw}px ${s.sh}px; width: 120px; height: 68px"></div>`;
      }
    }

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
