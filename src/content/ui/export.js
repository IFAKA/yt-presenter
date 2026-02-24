// Export presentation as self-contained HTML slides, PDF, or PowerPoint (.pptx)

window.YTPresenter = window.YTPresenter || {};

(function () {

  // ── Shared helpers ──────────────────────────────────────────────────────────

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

  // ── HTML export ─────────────────────────────────────────────────────────────

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

// Auto-print when opened with #print hash (used by PDF export)
if (location.hash === '#print') {
  setTimeout(function() {
    var wrap = document.getElementById('print-wrap');
    wrap.innerHTML = SLIDES.map(function(s) {
      return '<div class="pw">' + buildSlide(s) + '</div>';
    }).join('');
    wrap.style.display = 'block';
    document.getElementById('slide').style.display = 'none';
    document.getElementById('nav').style.display = 'none';
    window.print();
  }, 500);
}

render();
</script>
</body>
</html>`;
  }

  // ── ZIP / PPTX export ───────────────────────────────────────────────────────

  var _crcTable = null;
  function getCrcTable() {
    if (_crcTable) return _crcTable;
    _crcTable = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTable[i] = c;
    }
    return _crcTable;
  }

  function crc32(data) {
    var t = getCrcTable();
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < data.length; i++) crc = t[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function str2u8(s) {
    return new TextEncoder().encode(s);
  }

  function dosDateTime() {
    var d = new Date();
    return {
      t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  function makeZip(files) {
    // files: [{name: string, data: string|Uint8Array}]
    var encoded = files.map(function(f) {
      return {
        name: str2u8(f.name),
        data: typeof f.data === 'string' ? str2u8(f.data) : f.data
      };
    });

    var localParts = [];
    var cdParts = [];
    var off = 0;
    var dt = dosDateTime();

    encoded.forEach(function(f) {
      var crc = crc32(f.data);
      var sz = f.data.length;
      var nl = f.name.length;

      var lh = new Uint8Array(30 + nl);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034B50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0, true);
      lv.setUint16(8, 0, true); // stored (no compression)
      lv.setUint16(10, dt.t, true);
      lv.setUint16(12, dt.d, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, sz, true);
      lv.setUint32(22, sz, true);
      lv.setUint16(26, nl, true);
      lv.setUint16(28, 0, true);
      lh.set(f.name, 30);

      var cd = new Uint8Array(46 + nl);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014B50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dt.t, true);
      cv.setUint16(14, dt.d, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, sz, true);
      cv.setUint32(24, sz, true);
      cv.setUint16(28, nl, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, off, true);
      cd.set(f.name, 46);

      localParts.push(lh, f.data);
      cdParts.push(cd);
      off += 30 + nl + sz;
    });

    var cdOffset = off;
    var cdSize = cdParts.reduce(function(a, b) { return a + b.length; }, 0);

    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054B50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, encoded.length, true);
    ev.setUint16(10, encoded.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);

    var all = localParts.concat(cdParts).concat([eocd]);
    var total = all.reduce(function(a, b) { return a + b.length; }, 0);
    var result = new Uint8Array(total);
    var pos = 0;
    all.forEach(function(p) { result.set(p, pos); pos += p.length; });
    return result;
  }

  // ── PPTX XML generators ─────────────────────────────────────────────────────

  // Slide dimensions (16:9): 9144000 x 5143500 EMU
  var SW = 9144000, SH = 5143500;
  // Content safe area
  var CX = 457200, CY = 457200, CW = 8229600, CH = 4229100;

  function xmlDecl() { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'; }

  function pptxContentTypes(slideCount) {
    var overrides = '';
    for (var i = 1; i <= slideCount; i++) {
      overrides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
    return xmlDecl() + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${overrides}</Types>`;
  }

  function pptxRootRels() {
    return xmlDecl() + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  }

  function pptxPresentation(slideCount) {
    var sldIds = '';
    for (var i = 1; i <= slideCount; i++) {
      sldIds += `<p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`;
    }
    return xmlDecl() + `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldSz cx="${SW}" cy="${SH}" type="screen16x9"/>
<p:notesSz cx="6858000" cy="9144000"/>
<p:sldIdLst>${sldIds}</p:sldIdLst>
<p:defaultTextStyle>
<a:defPPr><a:defRPr lang="en-US"/></a:defPPr>
</p:defaultTextStyle>
</p:presentation>`;
  }

  function pptxPresentationRels(slideCount) {
    var rels = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
    for (var i = 1; i <= slideCount; i++) {
      rels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
    }
    return xmlDecl() + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
  }

  function pptxTheme() {
    return xmlDecl() + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="YTPresenter">
<a:themeElements>
<a:clrScheme name="YTPresenter">
<a:dk1><a:srgbClr val="0F0F0F"/></a:dk1>
<a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1A1A1A"/></a:dk2>
<a:lt2><a:srgbClr val="E8E8E8"/></a:lt2>
<a:accent1><a:srgbClr val="3EA6FF"/></a:accent1>
<a:accent2><a:srgbClr val="F0C674"/></a:accent2>
<a:accent3><a:srgbClr val="A8FF3E"/></a:accent3>
<a:accent4><a:srgbClr val="FF6B6B"/></a:accent4>
<a:accent5><a:srgbClr val="C678DD"/></a:accent5>
<a:accent6><a:srgbClr val="56B6C2"/></a:accent6>
<a:hlink><a:srgbClr val="3EA6FF"/></a:hlink>
<a:folHlink><a:srgbClr val="C678DD"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="YTPresenter">
<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="Office">
<a:fillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="70000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="70000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
</a:fillStyleLst>
<a:lnStyleLst>
<a:ln w="6350" cap="flat" cmpd="sng"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
<a:ln w="12700" cap="flat" cmpd="sng"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
<a:ln w="19050" cap="flat" cmpd="sng"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
</a:lnStyleLst>
<a:effectStyleLst>
<a:effectStyle><a:effectLst/></a:effectStyle>
<a:effectStyle><a:effectLst/></a:effectStyle>
<a:effectStyle><a:effectLst/></a:effectStyle>
</a:effectStyleLst>
<a:bgFillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
</a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
</a:theme>`;
  }

  function pptxSlideMaster() {
    return xmlDecl() + `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld>
<p:bg><p:bgPr><a:solidFill><a:srgbClr val="0F0F0F"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree>
</p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles>
<p:titleStyle><a:lvl1pPr><a:defRPr lang="en-US" sz="4400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle>
<p:bodyStyle><a:lvl1pPr><a:defRPr lang="en-US" sz="2400"><a:solidFill><a:srgbClr val="E8E8E8"/></a:solidFill></a:defRPr></a:lvl1pPr></p:bodyStyle>
<p:otherStyle><a:lvl1pPr><a:defRPr lang="en-US" sz="1600"><a:solidFill><a:srgbClr val="C0C0C0"/></a:solidFill></a:defRPr></a:lvl1pPr></p:otherStyle>
</p:txStyles>
</p:sldMaster>`;
  }

  function pptxSlideMasterRels() {
    return xmlDecl() + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
  }

  function pptxSlideLayout() {
    return xmlDecl() + `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  type="blank" preserve="1">
<p:cSld name="Blank">
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree>
</p:cSld>
<p:clrMapOvr><a:masterClr/></p:clrMapOvr>
</p:sldLayout>`;
  }

  function pptxSlideLayoutRels() {
    return xmlDecl() + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
  }

  function pptxSlideRels() {
    return xmlDecl() + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
  }

  // Build a text shape (p:sp) for a slide
  // paragraphs: [{text, sz, bold, italic, color, align, spaceAfter}]
  function pptxShape(id, x, y, w, h, paragraphs, anchor) {
    var paras = paragraphs.map(function(p) {
      if (p.empty) {
        var spc = p.spaceAfter ? ` spcAft="${p.spaceAfter}"` : '';
        return `<a:p><a:pPr${spc}/><a:endParaRPr lang="en-US" sz="${p.sz || 1200}"/></a:p>`;
      }
      var rpr = `lang="en-US" sz="${p.sz || 2400}" b="${p.bold ? '1' : '0'}" i="${p.italic ? '1' : '0'}" dirty="0"`;
      if (p.spc) rpr += ` spc="${p.spc}"`;
      return `<a:p>
<a:pPr algn="${p.align || 'ctr'}"/>
<a:r><a:rPr ${rpr}><a:solidFill><a:srgbClr val="${p.color || 'E8E8E8'}"/></a:solidFill></a:rPr><a:t>${esc(p.text)}</a:t></a:r>
</a:p>`;
    });
    return `<p:sp>
<p:nvSpPr><p:cNvPr id="${id}" name="t${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:noFill/>
</p:spPr>
<p:txBody>
<a:bodyPr wrap="square" rtlCol="0" anchor="${anchor || 'ctr'}"/>
<a:lstStyle/>
${paras.join('\n')}
</p:txBody>
</p:sp>`;
  }

  function pptxSlideBg() {
    return '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="0F0F0F"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>';
  }

  function pptxSlideWrapper(shapes) {
    return xmlDecl() + `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld>
${pptxSlideBg()}
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${shapes}
</p:spTree>
</p:cSld>
<p:clrMapOvr><a:masterClr/></p:clrMapOvr>
</p:sld>`;
  }

  function pptxSlideXml(slide) {
    switch (slide.type) {

      case 'title':
        return pptxSlideWrapper(pptxShape(2, CX, CY, CW, CH, [
          { text: 'PRESENTATION', sz: 1000, color: '3EA6FF', spc: 200 },
          { empty: true, sz: 800, spaceAfter: 200000 },
          { text: slide.text, sz: 5400, bold: true, color: 'FFFFFF' }
        ]));

      case 'section':
        return pptxSlideWrapper(pptxShape(2, CX, CY, CW, CH, [
          { text: 'SECTION', sz: 1000, color: '3EA6FF', spc: 200 },
          { empty: true, sz: 800, spaceAfter: 200000 },
          { text: slide.text, sz: 4800, bold: true, color: '3EA6FF' }
        ]));

      case 'thought': {
        var shapes = '';
        // Section label at top
        if (slide.section) {
          shapes += pptxShape(2, CX, CY, CW, 500000, [
            { text: slide.section.toUpperCase(), sz: 900, color: '505050', align: 'ctr' }
          ], 'ctr');
        }
        // Main thought text in center
        shapes += pptxShape(3, CX, CY + 500000, CW, CH - 500000, [
          { text: slide.text, sz: 2800, color: 'E8E8E8', align: 'ctr' }
        ], 'ctr');
        return pptxSlideWrapper(shapes);
      }

      case 'recap':
        return pptxSlideWrapper(pptxShape(2, CX, CY, CW, CH, [
          { text: 'SO FAR', sz: 1000, color: 'F0C674', spc: 200 },
          { empty: true, sz: 800, spaceAfter: 200000 },
          { text: slide.text, sz: 2400, italic: true, color: 'C8C8C8' }
        ]));

      case 'takeaways': {
        var items = (slide.items || []).map(function(t, i) {
          return `<a:p>
<a:pPr algn="l"/>
<a:r><a:rPr lang="en-US" sz="2000" b="0" dirty="0"><a:solidFill><a:srgbClr val="3EA6FF"/></a:solidFill></a:rPr><a:t>${i + 1}. </a:t></a:r>
<a:r><a:rPr lang="en-US" sz="2000" b="0" dirty="0"><a:solidFill><a:srgbClr val="E8E8E8"/></a:solidFill></a:rPr><a:t>${esc(t)}</a:t></a:r>
</a:p>`;
        }).join('\n');

        var header = pptxShape(2, CX, CY, CW, 700000, [
          { text: 'KEY TAKEAWAYS', sz: 3200, bold: true, color: '3EA6FF' }
        ], 'ctr');

        var listShape = `<p:sp>
<p:nvSpPr><p:cNvPr id="3" name="t3"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="${CX + 457200}" y="${CY + 800000}"/><a:ext cx="${CW - 914400}" cy="${CH - 800000}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:noFill/>
</p:spPr>
<p:txBody>
<a:bodyPr wrap="square" rtlCol="0" anchor="t"/>
<a:lstStyle/>
${items}
</p:txBody>
</p:sp>`;

        return pptxSlideWrapper(header + listShape);
      }

      default:
        return pptxSlideWrapper('');
    }
  }

  function buildPptx(processedData, videoInfo) {
    const slides = buildSlides(processedData, videoInfo);
    const n = slides.length;

    var files = [
      { name: '[Content_Types].xml',                           data: pptxContentTypes(n) },
      { name: '_rels/.rels',                                   data: pptxRootRels() },
      { name: 'ppt/presentation.xml',                         data: pptxPresentation(n) },
      { name: 'ppt/_rels/presentation.xml.rels',              data: pptxPresentationRels(n) },
      { name: 'ppt/theme/theme1.xml',                         data: pptxTheme() },
      { name: 'ppt/slideMasters/slideMaster1.xml',            data: pptxSlideMaster() },
      { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: pptxSlideMasterRels() },
      { name: 'ppt/slideLayouts/slideLayout1.xml',            data: pptxSlideLayout() },
      { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: pptxSlideLayoutRels() },
    ];

    slides.forEach(function(slide, i) {
      var idx = i + 1;
      files.push({ name: `ppt/slides/slide${idx}.xml`,            data: pptxSlideXml(slide) });
      files.push({ name: `ppt/slides/_rels/slide${idx}.xml.rels`, data: pptxSlideRels() });
    });

    return makeZip(files);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  window.YTPresenter.exportPresentation = function (processedData, videoInfo, format) {
    const slug = (videoInfo?.title || 'presentation')
      .replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)
      .replace(/^-+|-+$/g, '') || 'presentation';

    if (format === 'pptx') {
      const bytes = buildPptx(processedData, videoInfo);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = slug + '.pptx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      return;
    }

    const html = buildHtml(processedData, videoInfo);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (format === 'pdf') {
      // Open with #print hash — the HTML detects this and auto-triggers window.print()
      window.open(url + '#print', '_blank');
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = slug + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }
  };
})();
