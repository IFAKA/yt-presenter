// Adaptive pacing: adjusts display duration based on complexity

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.SPEED_STEPS = [150, 200, 250, 300, 400, 500, 600];

window.YTPresenter.getSpeedLabel = function(wpm) {
  if (wpm <= 150) return 'Relaxed';
  if (wpm <= 300) return 'Normal';
  if (wpm <= 450) return 'Fast';
  return 'Speed';
};

window.YTPresenter.nextSpeed = function(current) {
  const steps = window.YTPresenter.SPEED_STEPS;
  const idx = steps.indexOf(current);
  if (idx === -1) return 250;
  return steps[Math.min(idx + 1, steps.length - 1)];
};

window.YTPresenter.prevSpeed = function(current) {
  const steps = window.YTPresenter.SPEED_STEPS;
  const idx = steps.indexOf(current);
  if (idx === -1) return 250;
  return steps[Math.max(idx - 1, 0)];
};
