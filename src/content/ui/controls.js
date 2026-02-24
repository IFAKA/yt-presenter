// Bottom controls bar: play/pause, prev/next, speed, progress, mode, close

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.Controls = class Controls {
  constructor(stage, timeline, callbacks) {
    this.stage = stage;
    this.timeline = timeline;
    this.callbacks = callbacks;
    this.el = null;
    this.hideTimer = null;
    this.wpm = timeline.wpm;
    this.videoDuration = 0;

    this._create();
    this._bindEvents();
    this.showControls();
  }

  _create() {
    this.el = document.createElement('div');
    this.el.className = 'ytpres-controls';
    this.el.innerHTML = `
      <div class="ytpres-progress-wrap">
        <div class="ytpres-progress-bar">
          <div class="ytpres-progress-fill"></div>
        </div>
        <div class="ytpres-progress-tooltip"></div>
      </div>
      <div class="ytpres-controls-inner">
        <div class="ytpres-controls-left">
          <button class="ytpres-btn ytpres-btn-prev" title="Previous (←)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button class="ytpres-btn ytpres-btn-play" title="Play/Pause (Space)">
            <svg class="ytpres-icon-play" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <svg class="ytpres-icon-pause" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <button class="ytpres-btn ytpres-btn-next" title="Next (→)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <span class="ytpres-section-info"></span>
        </div>
        <div class="ytpres-controls-right">
          <button class="ytpres-btn ytpres-btn-speed" title="Speed (↑/↓)">
            <span class="ytpres-speed-label"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:3px"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l4.5-4.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>Normal</span>
          </button>
          <button class="ytpres-btn ytpres-btn-outline" title="Outline (O)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
          </button>
          <button class="ytpres-btn ytpres-btn-export" title="Export">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
          <button class="ytpres-btn ytpres-btn-close" title="Close (T)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>
      <div class="ytpres-savings"></div>
    `;
    this.stage.appendChild(this.el);
    this._createSectionMarkers();
  }

  _createSectionMarkers() {
    const bar = this.el.querySelector('.ytpres-progress-bar');
    if (!bar || !this.timeline.sections.length || !this.timeline.totalDuration) return;

    // Position markers by time (not index count) so they match the time-based progress fill
    for (let si = 1; si < this.timeline.sections.length; si++) {
      const firstIdx = this.timeline.sectionStarts[si];
      if (firstIdx == null) continue;
      const startMs = this.timeline.schedule[firstIdx]?.startMs || 0;
      const pct = (startMs / this.timeline.totalDuration) * 100;
      const marker = document.createElement('div');
      marker.className = 'ytpres-section-marker';
      marker.style.left = `${pct}%`;
      bar.appendChild(marker);
    }
  }

  _bindEvents() {
    const q = (sel) => this.el.querySelector(sel);

    q('.ytpres-btn-play').addEventListener('click', () => this.timeline.togglePlay());
    q('.ytpres-btn-prev').addEventListener('click', () => this.timeline.prev());
    q('.ytpres-btn-next').addEventListener('click', () => this.timeline.next());
    q('.ytpres-btn-close').addEventListener('click', () => this.callbacks.onClose?.());
    q('.ytpres-btn-outline').addEventListener('click', () => this.callbacks.onOutlineToggle?.());

    this._exportBtn = q('.ytpres-btn-export');
    this._exportMenu = this._createExportMenu();
    this.el.appendChild(this._exportMenu);
    this._exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleExportMenu();
    });

    this._speedBtn = q('.ytpres-btn-speed');
    this._speedMenu = this._createSpeedMenu();
    this.el.appendChild(this._speedMenu);

    this._speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleSpeedMenu();
    });

    // Close menus when clicking outside
    this._onDocClick = (e) => {
      if (!this._speedMenu.contains(e.target) && !this._speedBtn.contains(e.target)) {
        this._closeSpeedMenu();
      }
      if (!this._exportMenu.contains(e.target) && !this._exportBtn.contains(e.target)) {
        this._closeExportMenu();
      }
    };
    document.addEventListener('click', this._onDocClick, true);

    this._progressWrap = q('.ytpres-progress-wrap');
    this._tooltip = q('.ytpres-progress-tooltip');
    this._dragging = false;
    this._wasPlayingBeforeDrag = false;

    // Helper: calculate target time from mouse event (matches the time-based progress fill)
    this._timeFromEvent = (e) => {
      const rect = this._progressWrap.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      return pct * this.timeline.totalDuration;
    };

    // Tooltip: show on hover
    this._onProgressMouseMove = (e) => {
      const time = this._timeFromEvent(e);
      const idx = this.timeline.getIndexAtTime(time);
      const thought = this.timeline.thoughts[idx];
      if (!thought) return;

      const title = thought.sectionTitle || '';
      let text = thought.text || '';
      if (text.length > 80) text = text.slice(0, 80) + '\u2026';

      this._tooltip.innerHTML = `<strong>${title}</strong><br>${text}`;
      this._tooltip.classList.add('ytpres-progress-tooltip-visible');

      // Position tooltip horizontally, clamped within bar
      const rect = this._progressWrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const tipWidth = this._tooltip.offsetWidth;
      const clampedX = Math.max(tipWidth / 2, Math.min(x, rect.width - tipWidth / 2));
      this._tooltip.style.left = `${clampedX}px`;

      // If dragging, also seek
      if (this._dragging) {
        this.timeline.seekToTime(time);
      }
    };

    this._onProgressMouseLeave = () => {
      if (!this._dragging) {
        this._tooltip.classList.remove('ytpres-progress-tooltip-visible');
      }
    };

    // Drag scrubbing: mousedown starts drag
    this._onProgressMouseDown = (e) => {
      e.preventDefault();
      this._dragging = true;
      this._wasPlayingBeforeDrag = this.timeline.playing;
      if (this.timeline.playing) this.timeline.pause();
      const time = this._timeFromEvent(e);
      this.timeline.seekToTime(time);
    };

    // Document-level listeners for drag
    this._onDocMouseMove = (e) => {
      if (!this._dragging) return;
      const time = this._timeFromEvent(e);
      this.timeline.seekToTime(time);

      // Update tooltip while dragging
      const thought = this.timeline.thoughts[this.timeline.getIndexAtTime(time)];
      if (thought) {
        const title = thought.sectionTitle || '';
        let text = thought.text || '';
        if (text.length > 80) text = text.slice(0, 80) + '\u2026';
        this._tooltip.innerHTML = `<strong>${title}</strong><br>${text}`;

        const rect = this._progressWrap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const tipWidth = this._tooltip.offsetWidth;
        const clampedX = Math.max(tipWidth / 2, Math.min(x, rect.width - tipWidth / 2));
        this._tooltip.style.left = `${clampedX}px`;
      }
    };

    this._onDocMouseUp = () => {
      if (!this._dragging) return;
      this._dragging = false;
      this._tooltip.classList.remove('ytpres-progress-tooltip-visible');
      if (this._wasPlayingBeforeDrag) this.timeline.play();
    };

    this._progressWrap.addEventListener('mousemove', this._onProgressMouseMove);
    this._progressWrap.addEventListener('mouseleave', this._onProgressMouseLeave);
    this._progressWrap.addEventListener('mousedown', this._onProgressMouseDown);
    document.addEventListener('mousemove', this._onDocMouseMove);
    document.addEventListener('mouseup', this._onDocMouseUp);

    // Store references for cleanup
    this._onPlay = () => this._updatePlayButton(true);
    this._onPause = () => this._updatePlayButton(false);
    this._onTick = (e) => this._updateProgress(e);

    this.timeline.on('play', this._onPlay);
    this.timeline.on('pause', this._onPause);
    this.timeline.on('tick', this._onTick);

    this._onMouseMove = () => this.showControls();
    this._onMouseLeave = () => this._scheduleHide();
    this.stage.addEventListener('mousemove', this._onMouseMove);
    this.stage.addEventListener('mouseleave', this._onMouseLeave);
  }

  _updatePlayButton(playing) {
    this.el.querySelector('.ytpres-icon-play').style.display = playing ? 'none' : '';
    this.el.querySelector('.ytpres-icon-pause').style.display = playing ? '' : 'none';
  }

  _updateProgress({ totalProgress }) {
    this.el.querySelector('.ytpres-progress-fill').style.width = `${totalProgress * 100}%`;
    const thought = this.timeline.thoughts[this.timeline.currentIndex];
    const sectionNum = thought ? thought.sectionIndex + 1 : 1;
    const totalSections = this.timeline.sections.length;
    const sectionTitle = thought?.sectionTitle || `Section ${sectionNum}`;
    this.el.querySelector('.ytpres-section-info').textContent =
      `${sectionTitle}  ·  ${sectionNum}/${totalSections}`;

    if (this.videoDuration > 0) {
      const savings = this.timeline.getVideoSavings(this.videoDuration);
      const savedMin = Math.round(savings.savedSeconds / 60);
      if (savedMin > 0) {
        this.el.querySelector('.ytpres-savings').textContent =
          `Saving ~${savedMin} min [video: ${formatTime(this.videoDuration * 1000)} | reading: ~${formatTime(this.timeline.totalDuration)}]`;
      }
    }
  }

  _createSpeedMenu() {
    const menu = document.createElement('div');
    menu.className = 'ytpres-speed-menu';
    const steps = window.YTPresenter.SPEED_STEPS;
    const labels = { 150: 'Relaxed', 200: 'Slow', 250: 'Normal', 300: 'Moderate', 400: 'Fast', 500: 'Faster', 600: 'Speed' };

    steps.forEach(wpm => {
      const item = document.createElement('div');
      item.className = 'ytpres-speed-menu-item';
      item.dataset.wpm = wpm;
      item.textContent = labels[wpm] || `${wpm} wpm`;
      if (wpm === this.wpm) item.classList.add('ytpres-speed-menu-active');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.wpm = wpm;
        this.timeline.setWpm(this.wpm);
        this.updateSpeedLabel();
        this._updateSpeedMenuActive();
        this._closeSpeedMenu();
        chrome.storage.local.set({ wpm });
      });
      menu.appendChild(item);
    });

    return menu;
  }

  _createExportMenu() {
    const menu = document.createElement('div');
    menu.className = 'ytpres-export-menu';
    const options = [
      { label: 'HTML Slides', format: 'html', icon: '⬇' },
      { label: 'PowerPoint (.pptx)', format: 'pptx', icon: '📊' },
      { label: 'Print / PDF', format: 'pdf', icon: '🖨' },
    ];
    options.forEach(({ label, format, icon }) => {
      const item = document.createElement('div');
      item.className = 'ytpres-export-menu-item';
      item.innerHTML = `<span class="ytpres-export-menu-icon">${icon}</span>${label}`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closeExportMenu();
        this.callbacks.onExport?.(format);
      });
      menu.appendChild(item);
    });
    return menu;
  }

  _toggleExportMenu() {
    this._exportMenu.classList.toggle('ytpres-export-menu-open');
  }

  _closeExportMenu() {
    this._exportMenu.classList.remove('ytpres-export-menu-open');
  }

  _toggleSpeedMenu() {
    this._speedMenu.classList.toggle('ytpres-speed-menu-open');
  }

  _closeSpeedMenu() {
    this._speedMenu.classList.remove('ytpres-speed-menu-open');
  }

  _updateSpeedMenuActive() {
    this._speedMenu.querySelectorAll('.ytpres-speed-menu-item').forEach(item => {
      item.classList.toggle('ytpres-speed-menu-active', Number(item.dataset.wpm) === this.wpm);
    });
  }

  updateSpeedLabel() {
    const label = window.YTPresenter.getSpeedLabel(this.wpm);
    const el = this.el.querySelector('.ytpres-speed-label');
    if (label === 'Normal') {
      el.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:3px"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l4.5-4.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>Normal';
    } else {
      el.textContent = label;
    }
  }

  setVideoDuration(seconds) {
    this.videoDuration = seconds;
  }

  showControls() {
    this.el.classList.add('ytpres-controls-visible');
    this._scheduleHide();
  }

  _scheduleHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (this.timeline.playing) {
        this.el.classList.remove('ytpres-controls-visible');
      }
    }, 3000);
  }

  destroy() {
    clearTimeout(this.hideTimer);
    document.removeEventListener('click', this._onDocClick, true);
    if (this.timeline) {
      this.timeline.off('play', this._onPlay);
      this.timeline.off('pause', this._onPause);
      this.timeline.off('tick', this._onTick);
    }
    if (this._progressWrap) {
      this._progressWrap.removeEventListener('mousemove', this._onProgressMouseMove);
      this._progressWrap.removeEventListener('mouseleave', this._onProgressMouseLeave);
      this._progressWrap.removeEventListener('mousedown', this._onProgressMouseDown);
    }
    document.removeEventListener('mousemove', this._onDocMouseMove);
    document.removeEventListener('mouseup', this._onDocMouseUp);
    if (this.stage) {
      this.stage.removeEventListener('mousemove', this._onMouseMove);
      this.stage.removeEventListener('mouseleave', this._onMouseLeave);
    }
    if (this.el) this.el.remove();
  }
};

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
