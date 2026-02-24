// Three layout modes: Flow, Stack, Impact
// Uses cross-fade overlap and staggered word reveals from effects.js

window.YTPresenter = window.YTPresenter || {};

(function() {
  'use strict';

  const { buildThoughtHTML, applyEntrance, renderMath } = window.YTPresenter;

  function killElements(container, selector) {
    container.querySelectorAll(selector).forEach(el => {
      el.getAnimations().forEach(a => a.cancel());
      el.querySelectorAll('*').forEach(c => c.getAnimations().forEach(a => a.cancel()));
      el.remove();
    });
  }

  // ——— Flow Layout ———
  // One thought centered, cross-dissolves between thoughts
  class FlowLayout {
    constructor(container) {
      this.container = container;
      this.currentEl = null;
      this._showGen = 0;
    }

    async show(thought) {
      const gen = ++this._showGen;

      // Nuke ALL existing flow elements — guarantees at most one
      this._killAll();

      const el = document.createElement('div');
      el.className = 'ytpres-flow';
      el.innerHTML = buildThoughtHTML(thought);
      renderMath(el);
      this.container.appendChild(el);
      this.currentEl = el;

      await applyEntrance(el, thought.energy);

      // If a newer show() was called while we animated, remove this stale element
      if (gen !== this._showGen && el.isConnected) {
        el.getAnimations().forEach(a => a.cancel());
        el.querySelectorAll('*').forEach(c => c.getAnimations().forEach(a => a.cancel()));
        el.remove();
      }
    }

    _killAll() {
      this.currentEl = null;
      killElements(this.container, '.ytpres-flow');
    }

    clear() {
      this._showGen++;
      this._killAll();
    }
  }

  // ——— Stack Layout ———
  // Items accumulate, current highlighted, previous dimmed
  class StackLayout {
    constructor(container) {
      this.container = container;
      this.stackEl = null;
      this.items = [];
      this.currentIndex = -1;
    }

    async show(thought, index) {
      // Backward navigation: rebuild stack up to the target index
      if (index < this.currentIndex) {
        this.clear();
      }

      if (!this.stackEl) {
        this.stackEl = document.createElement('div');
        this.stackEl.className = 'ytpres-stack';
        this.container.appendChild(this.stackEl);
      }

      if (index >= this.items.length) {
        const item = document.createElement('div');
        item.className = 'ytpres-stack-item';
        item.innerHTML = `
          <span class="ytpres-stack-marker">${this.items.length + 1}.</span>
          ${buildThoughtHTML(thought)}
        `;
        renderMath(item);
        this.stackEl.appendChild(item);
        this.items.push(item);
        await applyEntrance(item, thought.energy);
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Highlight current, dim previous
      this.items.forEach((item, i) => {
        if (i === this.items.length - 1) {
          item.classList.add('ytpres-stack-active');
          item.classList.remove('ytpres-stack-dim');
        } else {
          item.classList.remove('ytpres-stack-active');
          item.classList.add('ytpres-stack-dim');
        }
      });

      this.currentIndex = index;
    }

    clear() {
      if (this.stackEl) { this.stackEl.remove(); this.stackEl = null; }
      this.items = [];
      this.currentIndex = -1;
    }
  }

  // ——— Impact Layout ———
  // Large centered text, power word scaling, empty pause before reveal
  class ImpactLayout {
    constructor(container) {
      this.container = container;
      this.currentEl = null;
      this._showGen = 0;
    }

    async show(thought) {
      const gen = ++this._showGen;

      // Nuke ALL existing impact elements — guarantees at most one
      this._killAll();

      const el = document.createElement('div');
      el.className = 'ytpres-impact';

      // Use buildThoughtHTML so bionic reading works in Impact mode
      el.innerHTML = `<div class="ytpres-thought ytpres-impact-text">${buildThoughtHTML(thought)}</div>`;
      renderMath(el);

      // Upgrade the first emphasis word to also be a power word
      const emphasisSet = new Set((thought.emphasis || []).map(w => w.toLowerCase()));
      const wordSpans = el.querySelectorAll('.ytpres-word');
      for (const span of wordSpans) {
        const clean = span.textContent.toLowerCase().replace(/[^a-z']/g, '');
        if (emphasisSet.has(clean)) {
          span.classList.add('ytpres-power-word');
          break;
        }
      }
      this.container.appendChild(el);
      this.currentEl = el;

      await applyEntrance(el, thought.energy);

      // If a newer show() was called while we animated, remove this stale element
      if (gen !== this._showGen && el.isConnected) {
        el.getAnimations().forEach(a => a.cancel());
        el.querySelectorAll('*').forEach(c => c.getAnimations().forEach(a => a.cancel()));
        el.remove();
      }
    }

    _killAll() {
      this.currentEl = null;
      killElements(this.container, '.ytpres-impact');
    }

    clear() {
      this._showGen++;
      this._killAll();
    }
  }

  window.YTPresenter.FlowLayout = FlowLayout;
  window.YTPresenter.StackLayout = StackLayout;
  window.YTPresenter.ImpactLayout = ImpactLayout;
})();
