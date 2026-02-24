// Manages swapping between YouTube's video player and the YTPresenter stage

window.YTPresenter = window.YTPresenter || {};

(function() {
  let originalPlayerDisplay = null;
  let videoWasPaused = false;
  let pauseEnforcerInterval = null;

  window.YTPresenter.replacePlayer = function() {
    const player = document.getElementById('movie_player');
    if (!player) return null;

    const video = player.querySelector('video');
    if (video) {
      videoWasPaused = video.paused;
      video.pause();
    }

    // Keep the video paused while the reader is active — prevents YouTube's
    // own keyboard shortcuts from resuming playback behind the scenes.
    pauseEnforcerInterval = setInterval(() => {
      const v = document.querySelector('#movie_player video');
      if (v && !v.paused) v.pause();
    }, 500);

    originalPlayerDisplay = player.style.display;
    const rect = player.getBoundingClientRect();
    player.style.display = 'none';

    const stage = document.createElement('div');
    stage.id = 'ytpres-stage';
    stage.className = 'ytpres-root';
    const w = rect.width || 854;
    const h = rect.height || 480;
    stage.style.width = '100%';
    stage.style.aspectRatio = `${w} / ${h}`;

    const content = document.createElement('div');
    content.className = 'ytpres-content';
    stage.appendChild(content);

    player.parentElement.insertBefore(stage, player);
    return stage;
  };

  window.YTPresenter.restorePlayer = function() {
    if (pauseEnforcerInterval) {
      clearInterval(pauseEnforcerInterval);
      pauseEnforcerInterval = null;
    }

    const stage = document.getElementById('ytpres-stage');
    if (stage) stage.remove();

    const player = document.getElementById('movie_player');
    if (player) {
      player.style.display = originalPlayerDisplay || '';
      // Only resume if the video was playing before the reader opened
      if (!videoWasPaused) {
        const video = player.querySelector('video');
        if (video) video.play().catch(() => {});
      }
    }
    originalPlayerDisplay = null;
  };

  window.YTPresenter.getStage = function() {
    return document.getElementById('ytpres-stage');
  };

  window.YTPresenter.getContentArea = function() {
    const stage = window.YTPresenter.getStage();
    return stage?.querySelector('.ytpres-content') || null;
  };
})();
