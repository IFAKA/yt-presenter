// Subtle visual feedback at section completion

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.celebrate = function(stage) {
  const el = document.createElement('div');
  el.className = 'ytpres-celebration';
  stage.appendChild(el);
  setTimeout(() => el.remove(), 1500);

  const progressBar = stage.querySelector('.ytpres-progress-bar');
  if (progressBar) {
    progressBar.classList.add('ytpres-progress-pulse');
    setTimeout(() => progressBar.classList.remove('ytpres-progress-pulse'), 600);
  }
};
