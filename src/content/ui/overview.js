// Overview / Skim Mode — full-text scrollable view with click-to-seek

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.Overview = class Overview {
  constructor(stage, timeline) {
    this.stage = stage;
    this.timeline = timeline;
    this.el = null;
    this.visible = false;
    this._thoughtEls = [];
    this._wasPlaying = false;

    this._create();
    this._bindEvents();
  }

  _create() {
    this.el = document.createElement('div');
    this.el.className = 'ytpres-overview';

    const inner = document.createElement('div');
    inner.className = 'ytpres-overview-inner';

    const header = document.createElement('div');
    header.className = 'ytpres-overview-header';
    header.innerHTML = `
      <span class="ytpres-overview-title">Overview</span>
      <span class="ytpres-overview-hint">Click any thought to jump there</span>
    `;
    inner.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ytpres-overview-body';

    this.timeline.sections.forEach((section, si) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'ytpres-overview-section';

      const titleEl = document.createElement('div');
      titleEl.className = 'ytpres-overview-section-title';
      titleEl.textContent = section.title || `Section ${si + 1}`;
      sectionEl.appendChild(titleEl);

      this.timeline.thoughts.forEach((thought, ti) => {
        if (thought.sectionIndex !== si) return;

        const thoughtEl = document.createElement('div');
        thoughtEl.className = 'ytpres-overview-thought';
        thoughtEl.textContent = thought.text;
        thoughtEl.dataset.index = ti;

        if (ti === this.timeline.currentIndex) {
          thoughtEl.classList.add('ytpres-overview-current');
        }

        thoughtEl.addEventListener('click', () => {
          this.timeline.seekToIndex(ti);
          this.hide();
          if (this._wasPlaying) this.timeline.play();
        });

        sectionEl.appendChild(thoughtEl);
        this._thoughtEls[ti] = thoughtEl;
      });

      body.appendChild(sectionEl);
    });

    inner.appendChild(body);
    this.el.appendChild(inner);

    // Close on backdrop click
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });

    this.stage.appendChild(this.el);
  }

  _bindEvents() {
    this._onTick = ({ index }) => this._updateCurrent(index);
    this._onThoughtChange = ({ index }) => this._updateCurrent(index);
    this.timeline.on('tick', this._onTick);
    this.timeline.on('thoughtChange', this._onThoughtChange);
  }

  _updateCurrent(index) {
    this._thoughtEls.forEach((el, i) => {
      if (el) el.classList.toggle('ytpres-overview-current', i === index);
    });
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  show() {
    this.visible = true;
    this._wasPlaying = this.timeline.playing;
    if (this.timeline.playing) this.timeline.pause();

    // Update current highlight before showing
    this._updateCurrent(this.timeline.currentIndex);

    this.el.classList.add('ytpres-overview-visible');

    // Scroll current thought into view
    const currentEl = this._thoughtEls[this.timeline.currentIndex];
    if (currentEl) {
      requestAnimationFrame(() => {
        currentEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
  }

  hide() {
    this.visible = false;
    this.el.classList.remove('ytpres-overview-visible');
  }

  destroy() {
    if (this.timeline) {
      this.timeline.off('tick', this._onTick);
      this.timeline.off('thoughtChange', this._onThoughtChange);
    }
    if (this.el) this.el.remove();
    this._thoughtEls = [];
  }
};
