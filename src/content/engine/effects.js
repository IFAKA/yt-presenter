// Animation engine — research-backed cinematic motion
//
// Sources:
//   Emil Kowalski — emilkowal.ski/ui/great-animations
//   Josh Comeau — Spring physics, CSS animation
//   Josh Collinsworth — "Make it faster until too fast, then back off"
//   web.dev — Only animate transform + opacity
//
// Principles applied:
//   1. Per-energy easing curves (not one curve for everything)
//   2. Staggered word-by-word reveals (30-60ms per word)
//   3. Soft opacity start (0.0–0.4 → 1.0, not always 0 → 1)
//   4. Separate easing for opacity vs transform
//   5. Exit uses ease-in, faster than entrance
//   6. Cross-fade overlap (exit + entrance overlap by ~100ms)
//   7. will-change applied only during animation, then removed
//   8. Travel distances 8-24px max (not 30px+)
//   9. prefers-reduced-motion: fade-only fallback

window.YTPresenter = window.YTPresenter || {};

(function() {
  'use strict';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedMotionQuery.matches;
  reducedMotionQuery.addEventListener('change', (e) => { reducedMotion = e.matches; });

  // ——— Easing library ———
  // Each energy state gets its own curve tuned to its emotional character
  const EASING = {
    // Smooth deceleration — default entrance
    easeOut:       'cubic-bezier(0, 0, 0.58, 1)',
    // Cinematic entrance — spring-like settle without JS springs
    cinematic:     'cubic-bezier(0.2, 0.8, 0.2, 1)',
    // Snappy — fast attack, clean stop
    snappy:        'cubic-bezier(0.16, 0.9, 0.4, 1)',
    // Gentle — soft, unhurried
    gentle:        'cubic-bezier(0.4, 0.6, 0.3, 1)',
    // Dramatic — slow start, powerful arrival
    dramatic:      'cubic-bezier(0.0, 0.7, 0.1, 1)',
    // Exit — accelerates away
    exitEaseIn:    'cubic-bezier(0.42, 0, 1, 1)',
    // Exit soft — gentle departure
    exitSoft:      'cubic-bezier(0.4, 0, 0.7, 1)',
    // Linear — for opacity when paired with transform easing
    linear:        'linear',
  };

  // ——— Energy state definitions ———
  // Each state: entrance transform, easing, duration, opacity range, typography
  const ENERGY_STYLES = {
    calm_intro: {
      enter: {
        duration: 380,
        opacityFrom: 0.3,        // soft start
        transform: ['translateY(8px)', 'translateY(0)'],
        easing: EASING.gentle,
      },
      stagger: 50,               // ms between words
      fontWeight: '400',
      color: 'var(--ytpres-text)',
    },

    explanation: {
      enter: {
        duration: 320,
        opacityFrom: 0.2,
        transform: ['translateY(10px)', 'translateY(0)'],
        easing: EASING.cinematic,
      },
      stagger: 40,
      fontWeight: '400',
      color: 'var(--ytpres-text)',
    },

    building_tension: {
      enter: {
        duration: 280,
        opacityFrom: 0,
        transform: ['translateX(-12px)', 'translateX(0)'],
        easing: EASING.snappy,
      },
      stagger: 30,               // faster stagger = building urgency
      fontWeight: '500',
      color: 'var(--ytpres-text)',
    },

    climax: {
      enter: {
        duration: 500,
        opacityFrom: 0,
        transform: ['scale(0.92)', 'scale(1)'],
        easing: EASING.dramatic,
        preDelay: 300,            // empty beat before the reveal
      },
      stagger: 60,               // slower stagger = weight
      fontWeight: '600',
      color: 'var(--ytpres-accent)',
    },

    enumeration: {
      enter: {
        duration: 240,
        opacityFrom: 0.2,
        transform: ['translateX(-16px)', 'translateX(0)'],
        easing: EASING.snappy,
      },
      stagger: 0,                // list items appear as whole units
      fontWeight: '400',
      color: 'var(--ytpres-text)',
    },

    contrast: {
      enter: {
        duration: 300,
        opacityFrom: 0,
        transform: ['translateX(16px)', 'translateX(0)'],
        easing: EASING.cinematic,
      },
      stagger: 35,
      fontWeight: '500',
      color: 'var(--ytpres-text)',
    },

    emotional: {
      enter: {
        duration: 500,
        opacityFrom: 0.4,        // very soft fade — gentleness
        transform: ['translateY(0)', 'translateY(0)'], // no movement, just fade
        easing: EASING.gentle,
      },
      stagger: 55,               // slow, contemplative
      fontWeight: '300',
      fontStyle: 'italic',
      color: 'var(--ytpres-warm)',
    },

    question: {
      enter: {
        duration: 350,
        opacityFrom: 0.1,
        transform: ['translateY(-6px)', 'translateY(0)'],
        easing: EASING.easeOut,
      },
      stagger: 45,
      fontWeight: '400',
      color: 'var(--ytpres-text-secondary)',
    },

    resolution: {
      enter: {
        duration: 400,
        opacityFrom: 0.2,
        transform: ['scale(0.97)', 'scale(1)'],
        easing: EASING.cinematic,
      },
      stagger: 50,
      fontWeight: '500',
      color: 'var(--ytpres-text)',
    },
  };

  const escapeHtml = window.YTPresenter.escapeHtml;

  window.YTPresenter.getEnergyStyle = function(energy) {
    return ENERGY_STYLES[energy] || ENERGY_STYLES.explanation;
  };

  // ——— Staggered word entrance ———
  // Each word animates individually with a delay cascade.
  // Creates the cinematic "reading rhythm" feel.
  function animateWordsStaggered(container, energy) {
    const style = window.YTPresenter.getEnergyStyle(energy);
    const { duration, opacityFrom, transform, easing } = style.enter;
    const stagger = style.stagger || 0;

    const words = container.querySelectorAll('.ytpres-word');
    if (!words.length) return Promise.resolve();

    // Reduced motion: simple fade, no transform, no stagger
    if (reducedMotion) {
      return new Promise(resolve => {
        const anim = container.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 200, fill: 'forwards' }
        );
        anim.onfinish = resolve;
      });
    }

    // No stagger: animate the whole container as one unit
    if (stagger === 0) {
      container.style.willChange = 'transform, opacity';
      return new Promise(resolve => {
        const anim = container.animate(
          [
            { opacity: opacityFrom, transform: transform[0] },
            { opacity: 1, transform: transform[1] },
          ],
          { duration, easing, fill: 'forwards' }
        );
        const done = () => { container.style.willChange = ''; resolve(); };
        anim.onfinish = done;
        anim.oncancel = done;
      });
    }

    // Staggered: each word gets its own animation
    // Build delay array with punctuation-aware pauses
    let cumulativeDelay = 0;
    const delays = Array.from(words).map((word, i) => {
      const d = cumulativeDelay;
      cumulativeDelay += stagger;
      // Add pause after punctuation-ending words
      const text = word.textContent || '';
      if (/[.!?]$/.test(text)) cumulativeDelay += stagger * 3;        // sentence end
      else if (/[,;:\u2014]$/.test(text)) cumulativeDelay += stagger * 1.5; // clause break
      return d;
    });

    // Batch: hide all words and enable will-change via container classes
    container.classList.add('ytpres-word-hidden', 'ytpres-word-animating');

    const animations = [];
    // Use rAF to start animations after the class-based hide is painted
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        words.forEach((word, i) => {
          const delay = delays[i];

          // Separate opacity and transform animations for depth
          const opacityAnim = word.animate(
            [{ opacity: opacityFrom }, { opacity: 1 }],
            {
              duration: duration * 0.7,
              delay,
              easing: EASING.linear,
              fill: 'forwards',
            }
          );

          const transformAnim = word.animate(
            [{ transform: transform[0] }, { transform: transform[1] }],
            {
              duration,
              delay,
              easing,
              fill: 'forwards',
            }
          );

          animations.push(opacityAnim, transformAnim);
        });

        const cleanup = () => {
          container.classList.remove('ytpres-word-hidden', 'ytpres-word-animating');
        };

        const last = animations[animations.length - 1];
        if (last) {
          last.onfinish = () => { cleanup(); resolve(); };
          last.oncancel = () => { cleanup(); resolve(); };
        } else {
          cleanup();
          resolve();
        }
      });
    });
  }

  // ——— Entrance: applies to a thought element ———
  window.YTPresenter.applyEntrance = function(element, energy) {
    const style = window.YTPresenter.getEnergyStyle(energy);
    const preDelay = style.enter.preDelay || 0;

    element.style.opacity = '0';

    return new Promise(resolve => {
      setTimeout(() => {
        element.style.opacity = '';
        animateWordsStaggered(element, energy).then(resolve);
      }, preDelay);
    });
  };

  // ——— Exit: ease-in, faster than entrance ———
  window.YTPresenter.applyExit = function(element, duration) {
    duration = duration || 180;    // exits should be quick

    if (reducedMotion) {
      element.style.opacity = '0';
      return Promise.resolve();
    }

    element.style.willChange = 'opacity';

    return new Promise(resolve => {
      const anim = element.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        {
          duration,
          easing: EASING.exitEaseIn,
          fill: 'forwards',
        }
      );
      const done = () => { element.style.willChange = ''; resolve(); };
      anim.onfinish = done;
      anim.oncancel = done;
    });
  };

  // ——— Parse text into math and non-math segments ———
  // Finds $$...$$ (display) and $...$ (inline) blocks
  function parseMathSegments(text) {
    const segments = [];
    // Match $$...$$ (display) or $...$ (inline), non-greedy
    const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g;
    let lastIndex = 0;
    let match;

    while ((match = mathRegex.exec(text)) !== null) {
      // Text before this math block
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      const raw = match[0];
      if (raw.startsWith('$$')) {
        segments.push({ type: 'display-math', content: raw.slice(2, -2).trim() });
      } else {
        segments.push({ type: 'inline-math', content: raw.slice(1, -1).trim() });
      }
      lastIndex = mathRegex.lastIndex;
    }
    // Remaining text
    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.slice(lastIndex) });
    }
    return segments;
  }

  // ——— Build word spans for a plain-text segment ———
  function buildWordsHTML(text, emphasisSet, bionicEnabled) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return words.map(word => {
      const clean = word.toLowerCase().replace(/[^a-z']/g, '');
      const isEmphasis = emphasisSet.has(clean);
      const cls = isEmphasis ? 'ytpres-word ytpres-emphasis' : 'ytpres-word';

      if (bionicEnabled) {
        const bionicLen = Math.max(1, Math.min(3, Math.ceil(word.length * 0.4)));
        const prefix = escapeHtml(word.slice(0, bionicLen));
        const suffix = escapeHtml(word.slice(bionicLen));
        return `<span class="${cls}"><b>${prefix}</b>${suffix}</span>`;
      }

      return `<span class="${cls}">${escapeHtml(word)}</span>`;
    }).join(' ');
  }

  // ——— Build thought HTML with word-level spans ———
  // Each word wrapped in .ytpres-word for staggered animation
  // Math segments ($...$, $$...$$) are preserved as atomic units
  window.YTPresenter.buildThoughtHTML = function(thought, options) {
    const style = window.YTPresenter.getEnergyStyle(thought.energy);
    const emphasisSet = new Set((thought.emphasis || []).map(w => w.toLowerCase().replace(/[^a-z']/g, '')));
    const bionicEnabled = (options?.bionic ?? window.YTPresenter.bionicEnabled) !== false;

    const segments = parseMathSegments(thought.text);
    const htmlParts = segments.map(seg => {
      if (seg.type === 'display-math') {
        return `<div class="ytpres-math-block ytpres-word" data-latex="${escapeHtml(seg.content)}"></div>`;
      } else if (seg.type === 'inline-math') {
        return `<span class="ytpres-math ytpres-word" data-latex="${escapeHtml(seg.content)}"></span>`;
      }
      return buildWordsHTML(seg.content, emphasisSet, bionicEnabled);
    });

    const html = htmlParts.join(' ');
    const fontWeight = style.fontWeight || '400';
    const fontStyle = style.fontStyle || 'normal';
    const color = style.color || 'var(--ytpres-text)';

    return `<div class="ytpres-thought" style="font-weight:${fontWeight};font-style:${fontStyle};color:${color}">${html}</div>`;
  };

  // ——— Render KaTeX math in a container ———
  window.YTPresenter.renderMath = function(container) {
    if (typeof katex === 'undefined') return;
    container.querySelectorAll('.ytpres-math, .ytpres-math-block').forEach(el => {
      const latex = el.dataset.latex;
      if (!latex) return;
      const displayMode = el.classList.contains('ytpres-math-block');
      try {
        katex.render(latex, el, { displayMode, throwOnError: false });
      } catch (e) { /* graceful degradation — leave element empty */ }
    });
  };

})();
