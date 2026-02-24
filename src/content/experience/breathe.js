// Breathing pauses at section transitions

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.showBreathe = function(container, thumbnail) {
  // Clear previous thought text so transition overlays appear alone
  container.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'ytpres-breathe';

  let thumbHtml = '';
  if (thumbnail) {
    if (typeof thumbnail === 'string') {
      thumbHtml = `<div class="ytpres-breathe-thumb" style="background-image: url(${thumbnail})"></div>`;
    } else if (thumbnail.url) {
      // Storyboard sprite: position background to show the correct frame
      const s = thumbnail.sprite;
      thumbHtml = `<div class="ytpres-breathe-thumb" style="background-image: url(${thumbnail.url}); background-position: -${s.x}px -${s.y}px; background-size: ${s.sw}px ${s.sh}px"></div>`;
    }
  }

  el.innerHTML = thumbHtml + '<div class="ytpres-breathe-glow"></div>';
  container.appendChild(el);

  return new Promise(resolve => {
    setTimeout(() => { el.remove(); resolve(); }, 2500);
  });
};
