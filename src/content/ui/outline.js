// Outline panel — section-based navigation and skimming

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.Outline = class Outline {
  constructor(stage, timeline) {
    this.stage = stage;
    this.timeline = timeline;
    this.el = null;
    this.visible = true;
    this._items = [];

    this._create();
    this._bindEvents();
    this._applyContentShift();
  }

  _create() {
    this.el = document.createElement('div');
    this.el.className = 'ytpres-outline ytpres-outline-visible';

    const title = document.createElement('div');
    title.className = 'ytpres-outline-title';
    title.textContent = 'Outline';
    this.el.appendChild(title);

    const list = document.createElement('div');
    list.className = 'ytpres-outline-list';

    this.timeline.sections.forEach((section, i) => {
      const item = document.createElement('div');
      item.className = 'ytpres-outline-item';
      if (i === 0) item.classList.add('ytpres-outline-active');
      item.dataset.sectionIndex = i;

      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'ytpres-outline-item-title';
      sectionTitle.textContent = section.title || `Section ${i + 1}`;

      item.appendChild(sectionTitle);

      if (section.recap) {
        const recap = document.createElement('div');
        recap.className = 'ytpres-outline-recap';
        recap.textContent = section.recap;
        item.appendChild(recap);
      }

      item.addEventListener('click', () => {
        const firstThought = this.timeline.sectionStarts[i];
        if (firstThought != null) this.timeline.seekToIndex(firstThought);
      });

      list.appendChild(item);
      this._items.push(item);
    });

    this.el.appendChild(list);
    this.stage.appendChild(this.el);
  }

  _bindEvents() {
    this._onThoughtChange = ({ index }) => this._highlightSection(index);
    this._onSectionChange = ({ sectionIndex }) => this._setActive(sectionIndex);

    this.timeline.on('thoughtChange', this._onThoughtChange);
    this.timeline.on('sectionChange', this._onSectionChange);
  }

  _highlightSection(thoughtIndex) {
    const thought = this.timeline.thoughts[thoughtIndex];
    if (thought) this._setActive(thought.sectionIndex);
  }

  _setActive(sectionIndex) {
    this._items.forEach((item, i) => {
      item.classList.toggle('ytpres-outline-active', i === sectionIndex);
    });

    // Scroll active item into view within the outline
    const activeItem = this._items[sectionIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('ytpres-outline-visible', this.visible);
    this._applyContentShift();
  }

  _applyContentShift() {
    const content = this.stage.querySelector('.ytpres-content');
    if (content) {
      content.style.paddingLeft = this.visible ? '280px' : '';
    }
  }

  destroy() {
    if (this.timeline) {
      this.timeline.off('thoughtChange', this._onThoughtChange);
      this.timeline.off('sectionChange', this._onSectionChange);
    }

    // Restore content padding
    const content = this.stage?.querySelector('.ytpres-content');
    if (content) content.style.paddingLeft = '';

    if (this.el) this.el.remove();
  }
};
