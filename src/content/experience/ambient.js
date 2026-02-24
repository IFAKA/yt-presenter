// Background engagement animation — respects prefers-reduced-motion

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.addAmbient = function(stage) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const el = document.createElement('div');
  el.className = 'ytpres-ambient';
  stage.insertBefore(el, stage.firstChild);
  return el;
};

window.YTPresenter.removeAmbient = function(stage) {
  const el = stage.querySelector('.ytpres-ambient');
  if (el) el.remove();
};
