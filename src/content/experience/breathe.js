// Breathing pauses at section transitions

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.showBreathe = function(container, thumbnailUrl) {
  // Clear previous thought text so transition overlays appear alone
  container.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'ytpres-breathe';

  let thumbHtml = '';
  if (thumbnailUrl) {
    thumbHtml = `<div class="ytpres-breathe-thumb" style="background-image: url(${thumbnailUrl})"></div>`;
  }

  el.innerHTML = thumbHtml + '<div class="ytpres-breathe-glow"></div>';
  container.appendChild(el);

  return new Promise(resolve => {
    setTimeout(() => { el.remove(); resolve(); }, 2500);
  });
};
