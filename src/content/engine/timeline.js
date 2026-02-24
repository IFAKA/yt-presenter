// Playback state machine — drives the reading experience

window.YTPresenter = window.YTPresenter || {};

window.YTPresenter.Timeline = class Timeline {
  constructor() {
    this.thoughts = [];
    this.sections = [];
    this.currentIndex = 0;
    this.currentTime = 0;
    this.rate = 1.0;
    this.wpm = 250;
    this.playing = false;
    this.rafId = null;
    this.lastFrameTime = 0;
    this.listeners = new Map();
    this.schedule = [];
    this.totalDuration = 0;
    this._lastSectionEndEmittedIndex = -1;
  }

  load(data, wpm) {
    this.wpm = wpm || 250;
    this.sections = data.sections || [];
    this.thoughts = [];

    for (let si = 0; si < this.sections.length; si++) {
      const section = this.sections[si];
      const thoughts = section.thoughts || [];
      for (let ti = 0; ti < thoughts.length; ti++) {
        this.thoughts.push({
          ...thoughts[ti],
          sectionIndex: si,
          sectionTitle: section.title,
          sectionRecap: section.recap,
          isFirstInSection: ti === 0,
          isLastInSection: ti === thoughts.length - 1,
        });
      }
    }

    this.buildSchedule();
    this.currentIndex = 0;
    this.currentTime = 0;
  }

  buildSchedule() {
    const ENERGY_MULTIPLIERS = {
      climax: 1.4,
      emotional: 1.3,
      building_tension: 0.9,
      enumeration: 0.85,
    };

    this.schedule = [];
    let time = 0;

    for (let i = 0; i < this.thoughts.length; i++) {
      const thought = this.thoughts[i];
      const wordCount = thought.text.split(/\s+/).length;
      const baseMs = (wordCount / this.wpm) * 60000;
      const complexity = thought.complexity || 0.5;
      const complexityMultiplier = 1 + (complexity - 0.5) * 0.4;
      const energyMultiplier = ENERGY_MULTIPLIERS[thought.energy] || 1.0;
      // Extra time for multi-sentence thoughts (200ms per extra sentence boundary)
      const sentences = (thought.text.match(/[.!?]+/g) || []).length;
      const punctuationBonus = Math.max(0, sentences - 1) * 200;
      const displayMs = Math.max(1200, baseMs * complexityMultiplier * energyMultiplier + punctuationBonus);
      const breathePause = thought.isFirstInSection && i > 0 ? 2500 : 0;
      const recapReadMs = thought.isLastInSection && thought.sectionRecap
        ? Math.max(2000, (thought.sectionRecap.split(/\s+/).length / this.wpm) * 60000)
        : 0;
      // Reserve breathe (2500ms) + recap reading time so the schedule gap is large
      // enough for both transitions. sectionEnd fires at displayMs; the gap fills both.
      const recapPause = recapReadMs > 0 ? recapReadMs + 2500 : 0;

      const start = time + breathePause;
      const end = start + displayMs;

      this.schedule.push({
        index: i,
        startMs: start,
        endMs: end + recapPause,
        displayMs,
        breathePauseMs: breathePause,
        recapPauseMs: recapPause,
      });

      time = end + recapPause;
    }

    this.totalDuration = time;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.lastFrameTime = performance.now();
    this._tick();
    this.emit('play');
  }

  pause() {
    this.playing = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.emit('pause');
  }

  togglePlay() {
    if (this.playing) this.pause(); else this.play();
  }

  _tick() {
    if (!this.playing) return;

    const now = performance.now();
    const delta = (now - this.lastFrameTime) * this.rate;
    this.lastFrameTime = now;
    this.currentTime += delta;

    const newIndex = this._getIndexAtTime(this.currentTime);
    if (newIndex !== this.currentIndex) {
      const prevIndex = this.currentIndex;
      this._lastSectionEndEmittedIndex = -1; // reset so sectionEnd can re-fire on the new thought
      this.currentIndex = newIndex;
      this.emit('thoughtChange', { index: newIndex, prevIndex, thought: this.thoughts[newIndex] });

      if (this.thoughts[newIndex]?.sectionIndex !== this.thoughts[prevIndex]?.sectionIndex) {
        this.emit('sectionChange', {
          sectionIndex: this.thoughts[newIndex].sectionIndex,
          section: this.sections[this.thoughts[newIndex].sectionIndex],
        });
      }
    }

    if (this.currentTime >= this.totalDuration) {
      this.playing = false;
      this.emit('end');
      return;
    }

    // Emit sectionEnd the first time we cross into the recap-pause gap of the
    // last thought in a section. This fires BEFORE sectionChange (which fires
    // when the next section's index becomes active), so breathe/recap can show
    // during the scheduled gap rather than after it.
    const endSched = this.schedule[this.currentIndex];
    const endThought = this.thoughts[this.currentIndex];
    if (
      endThought?.isLastInSection &&
      endThought?.sectionRecap &&
      endSched &&
      this.currentTime >= endSched.startMs + endSched.displayMs &&
      this._lastSectionEndEmittedIndex !== this.currentIndex
    ) {
      this._lastSectionEndEmittedIndex = this.currentIndex;
      this.emit('sectionEnd', {
        sectionIndex: endThought.sectionIndex,
        section: this.sections[endThought.sectionIndex],
      });
    }

    const sched = this.schedule[this.currentIndex];
    if (sched) {
      const thoughtProgress = Math.min(1, (this.currentTime - sched.startMs) / sched.displayMs);
      this.emit('tick', {
        time: this.currentTime,
        index: this.currentIndex,
        thought: this.thoughts[this.currentIndex],
        progress: thoughtProgress,
        totalProgress: this.currentTime / this.totalDuration,
      });
    }

    this.rafId = requestAnimationFrame(() => this._tick());
  }

  _getIndexAtTime(timeMs) {
    for (let i = this.schedule.length - 1; i >= 0; i--) {
      if (timeMs >= this.schedule[i].startMs) return i;
    }
    return 0;
  }

  next() {
    if (this.currentIndex < this.thoughts.length - 1) {
      const prevIndex = this.currentIndex;
      this.currentIndex++;
      this.currentTime = this.schedule[this.currentIndex].startMs;
      this._emitSeek(prevIndex);
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      const prevIndex = this.currentIndex;
      this.currentIndex--;
      this.currentTime = this.schedule[this.currentIndex].startMs;
      this._emitSeek(prevIndex);
    }
  }

  seekToIndex(index) {
    if (index >= 0 && index < this.thoughts.length) {
      const prevIndex = this.currentIndex;
      this.currentIndex = index;
      this.currentTime = this.schedule[index].startMs;
      this._emitSeek(prevIndex);
    }
  }

  seekToTime(timeMs) {
    const prevIndex = this.currentIndex;
    this.currentTime = Math.max(0, Math.min(timeMs, this.totalDuration - 1));
    this.currentIndex = this._getIndexAtTime(this.currentTime);
    this._emitSeek(prevIndex);
  }

  getIndexAtTime(timeMs) {
    return this._getIndexAtTime(timeMs);
  }

  // Unified seek emission — keeps all UI in sync
  _emitSeek(prevIndex) {
    const thought = this.thoughts[this.currentIndex];
    this.emit('thoughtChange', { index: this.currentIndex, prevIndex, thought });

    // Emit sectionChange if we crossed a section boundary
    if (thought?.sectionIndex !== this.thoughts[prevIndex]?.sectionIndex) {
      this.emit('sectionChange', {
        sectionIndex: thought.sectionIndex,
        section: this.sections[thought.sectionIndex],
      });
    }

    // Emit a tick so progress bar / controls update even when paused
    const sched = this.schedule[this.currentIndex];
    if (sched) {
      this.emit('tick', {
        time: this.currentTime,
        index: this.currentIndex,
        thought,
        progress: 0,
        totalProgress: this.totalDuration > 0 ? this.currentTime / this.totalDuration : 0,
      });
    }
  }

  setRate(rate) {
    this.rate = Math.max(0.25, Math.min(4, rate));
    this.emit('rateChange', { rate: this.rate });
  }

  setWpm(wpm) {
    this.wpm = wpm;
    const savedIndex = this.currentIndex;
    this.buildSchedule();
    // Restore to the start of the same thought (not a linear fraction)
    if (savedIndex < this.schedule.length) {
      this.currentTime = this.schedule[savedIndex].startMs;
    }
    // Emit tick so UI updates immediately (even when paused)
    if (!this.playing) {
      this.emit('tick', {
        time: this.currentTime,
        index: this.currentIndex,
        thought: this.thoughts[this.currentIndex],
        progress: 0,
        totalProgress: this.totalDuration > 0 ? this.currentTime / this.totalDuration : 0,
      });
    }
  }

  getRemainingTime() {
    return Math.max(0, this.totalDuration - this.currentTime);
  }

  getVideoSavings(videoDurationSec) {
    const readingTimeSec = this.totalDuration / 1000;
    return {
      videoDuration: videoDurationSec,
      readingTime: readingTimeSec,
      savedSeconds: Math.max(0, videoDurationSec - readingTimeSec),
    };
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  off(event, fn) {
    const fns = this.listeners.get(event);
    if (fns) this.listeners.set(event, fns.filter(f => f !== fn));
  }

  emit(event, data) {
    const fns = this.listeners.get(event);
    if (fns) fns.forEach(fn => fn(data));
  }

  destroy() {
    this.pause();
    this.listeners.clear();
  }
};
