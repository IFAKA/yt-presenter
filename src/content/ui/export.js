// Export presentation as self-contained HTML slides or PDF

window.YTPresenter = window.YTPresenter || {};

(function () {
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildSlides(processedData, videoInfo) {
    const slides = [];
    slides.push({ type: 'title', text: videoInfo?.title || 'Presentation' });
    for (const section of (processedData.sections || [])) {
      slides.push({ type: 'section', text: section.title || '' });
      for (const thought of (section.thoughts || [])) {
        slides.push({ type: 'thought', text: thought.text || '', section: section.title || '' });
      }
      if (section.recap) {
        slides.push({ type: 'recap', text: section.recap, section: section.title || '' });
      }
    }
    if (processedData.takeaways?.length) {
      slides.push({ type: 'takeaways', items: processedData.takeaways });
    }
    return slides;
  }

  function buildHtml(processedData, videoInfo) {
    const title = videoInfo?.title || 'Presentation';
    const slides = buildSlides(processedData, videoInfo);
    const slidesJson = JSON.stringify(slides);
    const titleEsc = esc(title);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleEsc}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%;
  background: #0a0a0a; color: #e8e8e8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
#slide {
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 6vw 8vw; text-align: center;
  transition: opacity 0.25s ease;
}
#slide.out { opacity: 0; }
.s-label {
  font-size: clamp(10px, 1.1vw, 13px);
  letter-spacing: .14em; text-transform: uppercase;
  color: #3ea6ff; margin-bottom: 1.2rem; opacity: .7;
}
.s-title {
  font-size: clamp(30px, 6.5vw, 84px);
  font-weight: 700; line-height: 1.1; letter-spacing: -.025em;
  color: #fff;
}
.s-section {
  font-size: clamp(24px, 5vw, 64px);
  font-weight: 600; line-height: 1.2; color: #3ea6ff;
}
.s-section-label {
  font-size: clamp(10px, 1.0vw, 12px);
  letter-spacing: .12em; text-transform: uppercase;
  color: #606060; margin-bottom: .9rem;
}
.s-thought {
  font-size: clamp(18px, 2.8vw, 40px);
  font-weight: 400; line-height: 1.55; color: #e8e8e8;
  max-width: 860px;
}
.s-recap-label {
  font-size: clamp(10px, 1.0vw, 12px);
  letter-spacing: .14em; text-transform: uppercase;
  color: #f0c674; margin-bottom: 1rem; opacity: .8;
}
.s-recap {
  font-size: clamp(16px, 2.2vw, 30px);
  font-weight: 400; line-height: 1.6; color: #c8c8c8;
  max-width: 780px; font-style: italic;
}
.s-takeaways-title {
  font-size: clamp(16px, 1.8vw, 26px);
  font-weight: 700; color: #3ea6ff; margin-bottom: 2rem;
}
.s-takeaways-list {
  list-style: none; text-align: left; max-width: 680px;
  counter-reset: item;
}
.s-takeaways-list li {
  font-size: clamp(13px, 1.6vw, 20px);
  line-height: 1.6; color: #e8e8e8;
  padding: .55rem 0 .55rem 1.8rem;
  position: relative;
  border-bottom: 1px solid rgba(255,255,255,.06);
  counter-increment: item;
}
.s-takeaways-list li:last-child { border-bottom: none; }
.s-takeaways-list li::before {
  content: counter(item);
  position: absolute; left: 0;
  color: #3ea6ff; font-weight: 700; font-size: .82em;
  top: .65rem;
}
#bar {
  position: fixed; top: 0; left: 0; height: 2px;
  background: #3ea6ff; transition: width .25s ease; z-index: 10;
}
#nav {
  position: fixed; bottom: 1.75rem; left: 50%;
  transform: translateX(-50%);
  display: flex; gap: .6rem; align-items: center;
  opacity: 0; transition: opacity .25s; pointer-events: none;
}
body:hover #nav { opacity: 1; pointer-events: auto; }
#nav button {
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.14);
  color: #e8e8e8; padding: .45rem 1.1rem;
  border-radius: 6px; cursor: pointer; font-size: 13px;
  transition: background .15s;
}
#nav button:hover { background: rgba(255,255,255,.18); }
#nav button:disabled { opacity: .3; cursor: default; }
#counter { font-size: 12px; color: #606060; min-width: 56px; text-align: center; }
/* Print / PDF */
@media print {
  html, body { background: #fff; color: #000; overflow: auto; }
  #nav, #bar, #slide { display: none !important; }
  .pw {
    page-break-after: always; break-after: page;
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 10vw; text-align: center;
  }
  .s-label, .s-section-label { color: #065fd4; }
  .s-title, .s-thought { color: #0a0a0a; }
  .s-section, .s-takeaways-title { color: #065fd4; }
  .s-takeaways-list li { color: #0a0a0a; border-color: #e0e0e0; }
  .s-takeaways-list li::before { color: #065fd4; }
  .s-recap-label { color: #b45309; }
  .s-recap { color: #0a0a0a; }
}
</style>
</head>
<body>
<div id="bar"></div>
<div id="slide"></div>
<div id="print-wrap" style="display:none"></div>
<div id="nav">
  <button id="btn-prev">&#8592; Prev</button>
  <span id="counter"></span>
  <button id="btn-next">Next &#8594;</button>
</div>
<script>
var SLIDES = ${slidesJson};
var cur = 0;
var slideEl = document.getElementById('slide');
var barEl = document.getElementById('bar');
var counterEl = document.getElementById('counter');
var btnPrev = document.getElementById('btn-prev');
var btnNext = document.getElementById('btn-next');

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildSlide(s) {
  if (s.type === 'title')
    return '<div class="s-label">Presentation</div><div class="s-title">' + esc(s.text) + '</div>';
  if (s.type === 'section')
    return '<div class="s-label">Section</div><div class="s-section">' + esc(s.text) + '</div>';
  if (s.type === 'thought')
    return '<div class="s-section-label">' + esc(s.section) + '</div><div class="s-thought">' + esc(s.text) + '</div>';
  if (s.type === 'recap')
    return '<div class="s-recap-label">So far</div><div class="s-recap">' + esc(s.text) + '</div>';
  if (s.type === 'takeaways') {
    var items = s.items.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('');
    return '<div class="s-takeaways-title">Key Takeaways</div><ul class="s-takeaways-list">' + items + '</ul>';
  }
  return '';
}

function render() {
  counterEl.textContent = (cur + 1) + ' / ' + SLIDES.length;
  barEl.style.width = ((cur + 1) / SLIDES.length * 100) + '%';
  btnPrev.disabled = cur === 0;
  btnNext.disabled = cur === SLIDES.length - 1;
  slideEl.innerHTML = buildSlide(SLIDES[cur]);
}

function go(n) {
  if (n < 0 || n >= SLIDES.length) return;
  slideEl.classList.add('out');
  setTimeout(function() {
    cur = n; render();
    slideEl.classList.remove('out');
  }, 200);
}

btnPrev.addEventListener('click', function() { go(cur - 1); });
btnNext.addEventListener('click', function() { go(cur + 1); });

document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); go(cur + 1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(cur - 1); }
  if (e.key === 'Home') { e.preventDefault(); go(0); }
  if (e.key === 'End') { e.preventDefault(); go(SLIDES.length - 1); }
});

window.addEventListener('beforeprint', function() {
  var wrap = document.getElementById('print-wrap');
  wrap.innerHTML = SLIDES.map(function(s) {
    return '<div class="pw">' + buildSlide(s) + '</div>';
  }).join('');
  wrap.style.display = 'block';
});
window.addEventListener('afterprint', function() {
  var wrap = document.getElementById('print-wrap');
  wrap.style.display = 'none';
  wrap.innerHTML = '';
});

render();
</script>
</body>
</html>`;
  }

  window.YTPresenter.exportPresentation = function (processedData, videoInfo, format) {
    const html = buildHtml(processedData, videoInfo);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (format === 'pdf') {
      const w = window.open(url, '_blank');
      if (w) {
        w.addEventListener('load', function () {
          setTimeout(function () { w.print(); }, 300);
        });
      }
    } else {
      const a = document.createElement('a');
      a.href = url;
      const slug = (videoInfo?.title || 'presentation')
        .replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)
        .replace(/^-+|-+$/g, '');
      a.download = (slug || 'presentation') + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }
  };
})();
