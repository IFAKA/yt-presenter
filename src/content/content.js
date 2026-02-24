// YTPresenter Content Script — Orchestrator
// ISOLATED world: manages the full pipeline from transcript to reading experience

(function() {
  'use strict';

  const YT = window.YTPresenter;

  // ——— State ———
  let captionTracks = null;
  let videoInfo = null;
  let chapters = null;
  let extendedData = null;
  let timeline = null;
  let animator = null;
  let controls = null;
  let outline = null;
  let overview = null;
  let active = false;
  let cachedResult = null;   // cached AI output keyed by videoId
  let cachedVideoId = null;
  let pipelinePort = null;   // active port to service worker for AI pipeline

  // ——— Listen for caption data from MAIN world ———
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'YTPRES_CAPTION_DATA') {
      captionTracks = event.data.tracks;
      videoInfo = event.data.videoInfo;
      chapters = event.data.chapters || null;
      extendedData = event.data.extended || null;

      // Feature 6: Description timestamps as chapter fallback
      if (!chapters && extendedData?.descriptionTimestamps?.length >= 2) {
        chapters = extendedData.descriptionTimestamps.map(ts => ({
          title: ts.title,
          startMs: ts.startTimeSeconds * 1000,
          thumbnails: [],
        }));
      }

      YT.injectReadButton(handleReadClick, captionTracks);
    }
  });

  // ——— Port-based pipeline messaging ———
  // Sends PROCESS_TRANSCRIPT via a persistent port so that page unload
  // auto-disconnects and aborts the in-flight Ollama request.
  function runPipeline(message) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: 'ytpres-pipeline' });
      pipelinePort = port;

      port.onMessage.addListener((msg) => {
        if (msg.type === 'PROCESSING_PROGRESS') {
          const stage = YT.getStage();
          if (stage) YT.updateLoadingProgress(stage, msg);
        } else if (msg.type === 'RESULT') {
          pipelinePort = null;
          port.disconnect();
          if (msg.success) resolve(msg);
          else reject(new Error(msg.error));
        }
      });

      port.onDisconnect.addListener(() => {
        pipelinePort = null;
        // If we get here without a RESULT, the port was severed
        reject(new Error('PORT_DISCONNECTED'));
      });

      port.postMessage(message);
    });
  }

  // ——— Main Read Click Handler ———
  async function handleReadClick() {
    if (active) {
      closeReader();
      return;
    }

    if (!captionTracks) {
      showError('no_captions');
      return;
    }

    active = true;

    const stage = YT.replacePlayer();
    if (!stage) { active = false; return; }

    YT.addAmbient(stage);
    YT.showLoading(stage, videoInfo || {}, extendedData);

    try {
      const videoId = videoInfo?.videoId || new URLSearchParams(location.search).get('v');
      let processedData;

      if (cachedResult && cachedVideoId === videoId) {
        // Reuse cached AI output — skip loading screen entirely
        processedData = cachedResult;
        YT.hideLoading(stage);
      } else {
        // Fetch and parse transcript
        const selectedLang = document.getElementById('ytpres-lang-select')?.value || 'en';
        const { segments } = await YT.fetchTranscript(captionTracks, videoId, selectedLang);
        const plainText = YT.segmentsToPlainText(segments);

        if (!plainText.trim()) throw new Error('NO_CAPTIONS');

        // Map segments to chapters if available
        const chapterData = chapters ? YT.mapSegmentsToChapters(segments, chapters) : null;

        // AI processing — no fallback, quality or nothing
        const swMessage = {
          type: 'PROCESS_TRANSCRIPT',
          transcript: plainText,
          durationSeconds: videoInfo?.lengthSeconds || 0,
        };
        if (chapterData && chapterData.length > 0) {
          swMessage.chapters = chapterData;
        }
        if (extendedData) {
          swMessage.videoContext = {
            title: videoInfo?.title || '',
            description: extendedData.description || '',
            keywords: extendedData.keywords || [],
            category: extendedData.category || '',
          };
        }
        const response = await runPipeline(swMessage);

        if (!response?.success || !response.data?.sections?.length) {
          throw new Error(response?.error || 'AI_PROCESSING_FAILED');
        }

        processedData = response.data;
        cachedResult = processedData;
        cachedVideoId = videoId;

        // Hide loading, wait for exit animation
        YT.hideLoading(stage);
        await new Promise(r => setTimeout(r, 450));
      }

      const content = YT.getContentArea();
      if (!content) { closeReader(); return; }

      // Initialize engine
      const { wpm } = await chrome.storage.local.get(['wpm']);
      timeline = new YT.Timeline();
      timeline.load(processedData, wpm);

      // Map chapter thumbnails onto timeline sections
      if (chapters) {
        mapChapterThumbnails(chapters, timeline.sections, extendedData, videoInfo);
      }

      animator = new YT.Animator(content, timeline);

      controls = new YT.Controls(stage, timeline, {
        onClose: closeReader,
        onModeChange: (mode) => animator.setMode(mode),
        getCurrentMode: () => animator.mode,
        onOutlineToggle: () => outline?.toggle(),
        onExport: (format) => YT.exportPresentation(processedData, videoInfo, format),
      });

      outline = new YT.Outline(stage, timeline);
      overview = new YT.Overview(stage, timeline);

      if (videoInfo?.lengthSeconds) {
        controls.setVideoDuration(videoInfo.lengthSeconds);
      }

      // Toggle paused class for text selection
      timeline.on('play', () => stage.classList.remove('ytpres-paused'));
      timeline.on('pause', () => stage.classList.add('ytpres-paused'));

      // Click-to-pause on content area (ignore text selection & double-clicks)
      const contentArea = YT.getContentArea();
      if (contentArea) {
        let mouseDownPos = null;
        let clickTimer = null;
        contentArea.addEventListener('mousedown', (e) => {
          mouseDownPos = { x: e.clientX, y: e.clientY };
        });
        contentArea.addEventListener('dblclick', () => {
          // Cancel pending single-click toggle so double-click selects text
          if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        });
        contentArea.addEventListener('click', (e) => {
          // Ignore clicks on buttons/controls
          if (e.target.closest('button, a, .ytpres-controls')) return;
          // Ignore if mouse moved (drag-to-select)
          if (mouseDownPos) {
            const dx = Math.abs(e.clientX - mouseDownPos.x);
            const dy = Math.abs(e.clientY - mouseDownPos.y);
            if (dx > 5 || dy > 5) return;
          }
          // Delay toggle to distinguish single-click from double-click
          if (clickTimer) clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            clickTimer = null;
            // Ignore if text is selected
            const sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) return;
            timeline.togglePlay();
          }, 250);
        });
      }

      // Experience events — queue section transitions to prevent overlap
      let sectionTransitionBusy = false;

      // Celebrate fires when entering a new section (index change)
      timeline.on('sectionChange', () => {
        const stg = YT.getStage();
        if (stg) YT.celebrate(stg);
      });

      // Breathe + recap fire at the END of the last thought's displayMs, while
      // the scheduled gap is still running — so they show at the right time.
      timeline.on('sectionEnd', async ({ section }) => {
        if (sectionTransitionBusy) return; // skip if a previous transition is still running
        const cnt = YT.getContentArea();
        if (cnt && section?.recap) {
          sectionTransitionBusy = true;
          window.YTPresenter.sectionTransitionBusy = true;
          try {
            await YT.showBreathe(cnt, section.thumbnailUrl);
            await YT.showRecap(cnt, section.recap, timeline.wpm, section.thumbnailUrl);
          } finally {
            sectionTransitionBusy = false;
            window.YTPresenter.sectionTransitionBusy = false;
          }
        }
      });

      timeline.on('end', async () => {
        // Wait for any in-flight breathe/recap to finish before showing takeaways
        while (sectionTransitionBusy) {
          await new Promise(r => setTimeout(r, 200));
        }
        const cnt = YT.getContentArea();
        if (cnt && processedData.takeaways?.length > 0) {
          setTimeout(() => YT.showTakeaways(cnt, processedData.takeaways, extendedData?.endscreenVideos), 500);
        }
      });

      // Render first thought and start
      const firstThought = timeline.thoughts[0];
      if (firstThought) await animator.render(firstThought, 0);
      timeline.play();

    } catch (err) {
      // Suppress port disconnect errors (user navigated away during processing)
      if (err.message === 'PORT_DISCONNECTED') return;
      console.error('[YTPresenter] Error:', err);
      const [rawType, detail] = err.message.split('|');
      const type = rawType === 'NO_CAPTIONS' ? 'no_captions' : rawType;
      showError(type, null, detail || rawType);
    }
  }

  // ——— Close Reader ———
  function closeReader() {
    if (pipelinePort) { pipelinePort.disconnect(); pipelinePort = null; }
    if (timeline) { timeline.destroy(); timeline = null; }
    if (animator) { animator.destroy(); animator = null; }
    if (controls) { controls.destroy(); controls = null; }
    if (outline) { outline.destroy(); outline = null; }
    if (overview) { overview.destroy(); overview = null; }

    const stage = YT.getStage();
    if (stage) YT.removeAmbient(stage);

    YT.restorePlayer();
    active = false;
  }

  // ——— Error UI ———
  function showError(type, stage, detail) {
    if (!stage) {
      stage = YT.getStage() || YT.replacePlayer();
      if (!stage) return;
    }

    const content = stage.querySelector('.ytpres-content') || stage;
    content.innerHTML = '';

    const errors = {
      no_captions: {
        title: 'No Captions Available',
        message: 'This video doesn\'t have captions. YTPresenter needs captions to create the reading experience.',
        actions: '<button class="ytpres-error-btn" id="ytpres-close-error-btn">Close</button>',
      },
      OLLAMA_NOT_RUNNING: {
        title: 'Ollama Not Running',
        message: 'YTPresenter requires Ollama for AI-restructured prose. Start it and try again.',
        actions: `
          <code data-cmd="ollama serve">ollama serve</code>
          <div class="ytpres-error-actions">
            <button class="ytpres-error-btn" id="ytpres-close-error-btn">Close</button>
          </div>
        `,
      },
      NO_MODELS_INSTALLED: {
        title: 'No Models Installed',
        message: 'Pull a model in your terminal, then try again. Any model works — llama3.2 is a good start.',
        actions: `
          <code data-cmd="ollama pull llama3.2">ollama pull llama3.2</code>
          <div class="ytpres-error-actions">
            <button class="ytpres-error-btn" id="ytpres-close-error-btn">Close</button>
          </div>
        `,
      },
      AI_PROCESSING_FAILED: {
        title: 'AI Processing Failed',
        message: 'The AI couldn\'t process this transcript. Make sure Ollama is running and try again.',
        actions: '<button class="ytpres-error-btn" id="ytpres-close-error-btn">Close</button>',
      },
      generic: {
        title: 'Something Went Wrong',
        message: detail || 'An unexpected error occurred.',
        actions: '<button class="ytpres-error-btn" id="ytpres-close-error-btn">Close</button>',
      },
    };

    const err = errors[type] || errors.generic;

    const el = document.createElement('div');
    el.className = 'ytpres-error';
    el.innerHTML = `
      <div class="ytpres-error-title">${err.title}</div>
      <div class="ytpres-error-message">${err.message}</div>
      ${err.actions}
    `;
    content.appendChild(el);

    // Copy command on click
    el.querySelectorAll('code[data-cmd]').forEach(code => {
      code.addEventListener('click', () => {
        const cmd = code.dataset.cmd;
        navigator.clipboard.writeText(cmd);
        const original = code.textContent;
        code.textContent = 'Copied!';
        setTimeout(() => code.textContent = original, 1500);
      });
    });

    el.querySelector('#ytpres-close-error-btn')?.addEventListener('click', closeReader);
  }

  // ——— Keyboard Shortcuts ———
  document.addEventListener('keydown', (e) => {
    if (!active || !timeline) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    // Stop event from reaching YouTube's player controls
    e.stopPropagation();
    e.stopImmediatePropagation();

    switch (e.key) {
      case ' ':
        e.preventDefault();
        timeline.togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        timeline.prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        timeline.next();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (controls) {
          controls.wpm = YT.nextSpeed(controls.wpm);
          timeline.setWpm(controls.wpm);
          controls.updateSpeedLabel();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (controls) {
          controls.wpm = YT.prevSpeed(controls.wpm);
          timeline.setWpm(controls.wpm);
          controls.updateSpeedLabel();
        }
        break;
      case 'b':
      case 'B':
        if (animator) animator.toggleBionic();
        break;
      case 't':
      case 'T':
        closeReader();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case '1':
        if (animator) { animator.setMode('flow'); controls?.updateModeLabel('flow'); }
        break;
      case '2':
        if (animator) { animator.setMode('stack'); controls?.updateModeLabel('stack'); }
        break;
      case '3':
        if (animator) { animator.setMode('impact'); controls?.updateModeLabel('impact'); }
        break;
      case 'o':
      case 'O':
        if (outline) outline.toggle();
        break;
      case 's':
      case 'S':
        if (overview) overview.toggle();
        break;
    }
  }, true);


  // ——— Fullscreen ———
  function toggleFullscreen() {
    const stage = YT.getStage();
    if (!stage) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      stage.requestFullscreen().catch(() => {});
    }
  }

  // ——— Storyboard-based chapter thumbnails ———

  function parseStoryboardSpec(spec, videoDurationSec) {
    const parts = spec.split('|');
    if (parts.length < 2) return null;

    const baseUrl = parts[0];
    // Use highest quality level (last config)
    const levelIndex = parts.length - 2;
    const fields = parts[parts.length - 1].split('#');
    if (fields.length < 6) return null;

    const width = parseInt(fields[0]);
    const height = parseInt(fields[1]);
    const frameCount = parseInt(fields[2]);
    const cols = parseInt(fields[3]);
    const rows = parseInt(fields[4]);
    const interval = parseInt(fields[5]); // ms between frames, 0 = auto
    const namePattern = fields[6] || 'M$M';
    const signature = fields[7] || '';

    const intervalMs = interval > 0 ? interval : Math.floor(videoDurationSec * 1000 / frameCount);

    return { baseUrl, levelIndex, width, height, frameCount, cols, rows, intervalMs, namePattern, signature };
  }

  function getStoryboardFrame(sb, timestampMs) {
    const frameIndex = Math.min(Math.floor(timestampMs / sb.intervalMs), sb.frameCount - 1);
    const framesPerSheet = sb.cols * sb.rows;
    const sheetIndex = Math.floor(frameIndex / framesPerSheet);
    const posInSheet = frameIndex % framesPerSheet;
    const col = posInSheet % sb.cols;
    const row = Math.floor(posInSheet / sb.cols);

    const resolvedName = sb.namePattern.replace('$M', sheetIndex);
    let url = sb.baseUrl.replace('$L', sb.levelIndex).replace('$N', resolvedName);
    if (sb.signature) {
      url += (url.includes('?') ? '&' : '?') + 'sigh=' + sb.signature;
    }

    return {
      url,
      sprite: {
        x: col * sb.width,
        y: row * sb.height,
        w: sb.width,
        h: sb.height,
        sw: sb.cols * sb.width,
        sh: sb.rows * sb.height,
      },
    };
  }

  function mapChapterThumbnails(chapters, sections, extended, vInfo) {
    const count = Math.min(chapters.length, sections.length);

    // First pass: assign YouTube-provided thumbnails
    const urls = [];
    for (let i = 0; i < count; i++) {
      const thumbs = chapters[i].thumbnails;
      if (thumbs?.length) {
        const url = thumbs[thumbs.length - 1].url;
        sections[i].thumbnailUrl = url;
        urls.push(url);
      }
    }

    // Detect duplicate thumbnails: if all URLs are the same, they're generic
    const allSame = urls.length > 1 && urls.every(u => u === urls[0]);
    if (!allSame) return; // thumbnails are unique — keep them

    // Try storyboard fallback
    const spec = extended?.storyboardSpec;
    const duration = vInfo?.lengthSeconds || 0;
    if (!spec || !duration) return;

    const sb = parseStoryboardSpec(spec, duration);
    if (!sb) return;

    console.log('[YTPresenter] Chapter thumbnails are identical — using storyboard frames');

    for (let i = 0; i < count; i++) {
      const frame = getStoryboardFrame(sb, chapters[i].startMs);
      sections[i].thumbnailUrl = frame;
    }
  }

  // ——— SPA Cleanup ———
  document.addEventListener('yt-navigate-start', () => {
    if (active) closeReader();
    YT.removeReadButton();
    cachedResult = null;
    cachedVideoId = null;
  });
})();
