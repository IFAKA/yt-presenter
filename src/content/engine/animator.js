// Main render loop — coordinates timeline, layouts, and effects

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.Animator = class Animator {
  constructor(container, timeline) {
    this.container = container;
    this.timeline = timeline;
    this.mode = 'flow';
    this.focusMode = false;
    // Bionic reading defaults to on; persisted preference loaded in content.js
    if (window.YTPresenter.bionicEnabled === undefined) window.YTPresenter.bionicEnabled = true;

    this.layouts = {
      flow: new window.YTPresenter.FlowLayout(container),
      stack: new window.YTPresenter.StackLayout(container),
      impact: new window.YTPresenter.ImpactLayout(container),
    };

    this.lastRenderedIndex = -1;
    this.lastEffectiveMode = null;
    this.renderGeneration = 0;

    this.timeline.on('thoughtChange', (e) => this.onThoughtChange(e));
  }

  setMode(mode) {
    if (this.mode === mode) return;
    // Clear all layouts when user manually changes mode
    Object.values(this.layouts).forEach(l => l.clear());
    this.mode = mode;
    this.lastRenderedIndex = -1;
    this.lastEffectiveMode = null;
    const thought = this.timeline.thoughts[this.timeline.currentIndex];
    if (thought) this.render(thought, this.timeline.currentIndex);
  }

  toggleBionic() {
    window.YTPresenter.bionicEnabled = !window.YTPresenter.bionicEnabled;
    // Persist preference (fire-and-forget; chrome.storage may not exist in demo)
    try { chrome.storage.local.set({ bionicEnabled: window.YTPresenter.bionicEnabled }); } catch {}
    // Re-render current thought to apply/remove bionic
    this.lastRenderedIndex = -1;
    const thought = this.timeline.thoughts[this.timeline.currentIndex];
    if (thought) this.render(thought, this.timeline.currentIndex);
    return window.YTPresenter.bionicEnabled;
  }

  setFocusMode(enabled) {
    this.focusMode = enabled;
    this.container.classList.toggle('ytpres-focus-mode', enabled);
  }

  async render(thought, index) {
    if (index === this.lastRenderedIndex) return;

    // Don't render during section transitions — breathe/recap own the container.
    // lastRenderedIndex is intentionally left unchanged so the thought re-renders
    // once the transition finishes and the next thoughtChange fires.
    if (window.YTPresenter.sectionTransitionBusy) return;

    const gen = ++this.renderGeneration;

    // Clear any lingering experience overlays (recap, breathe) so they
    // don't coexist with the next thought.
    this.container.querySelectorAll('.ytpres-recap, .ytpres-breathe, .ytpres-takeaways')
      .forEach(el => el.remove());

    const effectiveMode = this.mode === 'flow' ? (thought.mode || 'flow') : this.mode;
    const layout = this.layouts[effectiveMode] || this.layouts.flow;

    // Clear previous layout when mode changes between thoughts
    if (this.lastEffectiveMode && this.lastEffectiveMode !== effectiveMode) {
      this.layouts[this.lastEffectiveMode]?.clear();
    }
    this.lastEffectiveMode = effectiveMode;

    if (effectiveMode === 'stack') {
      await layout.show(thought, index);
    } else {
      await layout.show(thought);
    }

    // Only update if this render is still the latest
    if (gen === this.renderGeneration) {
      this.lastRenderedIndex = index;
    }
  }

  onThoughtChange({ index, thought }) {
    if (thought) this.render(thought, index);
  }

  clear() {
    Object.values(this.layouts).forEach(l => l.clear());
    this.lastRenderedIndex = -1;
    this.lastEffectiveMode = null;
  }

  destroy() {
    this.clear();
    this.container.innerHTML = '';
  }
};
