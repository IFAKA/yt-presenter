import { checkHealth, checkModel, generate, pickBestModel } from './ollama.js';
import { buildRestructureRequest, splitIntoSentenceChunks, buildChapterRequest, splitChapterIntoSubChunks, condenseTranscript, buildArcRequest, buildArcContext } from './prompts.js';

// Single pass if video is under ~20 minutes OR transcript under 3500 words
// Above that, chunk to stay within the model's native context window
const SINGLE_PASS_DURATION = 20 * 60;  // 20 minutes in seconds
const SINGLE_PASS_WORD_LIMIT = 3500;   // fallback if duration unknown

// Returns the model name to use, or null if none is available.
// Errors are surfaced as OLLAMA_NOT_RUNNING / NO_MODELS_INSTALLED in the pipeline.
async function getModel() {
  try {
    const health = await checkHealth();
    if (!health.running) return null;

    const availableModels = health.models;

    const result = await chrome.storage.local.get('model');
    if (result.model) {
      // Verify the saved model is still installed
      const stillAvailable = availableModels.some(
        m => m === result.model || m.startsWith(result.model + ':')
      );
      if (stillAvailable) return result.model;
      // Saved model is gone — clear it and fall through to auto-select
      chrome.storage.local.remove('model');
    }

    // Auto-select the best available model
    if (health.modelDetails?.length) {
      const best = pickBestModel(health.modelDetails);
      if (best) {
        chrome.storage.local.set({ model: best.name });
        return best.name;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Full pipeline: single pass for short/normal videos, sentence-chunked for long ones
function makeTokenHandler(sendProgress, chunkIndex, totalChunks) {
  let lastReported = 0;
  return (tokenCount) => {
    if (tokenCount - lastReported >= 50) {
      lastReported = tokenCount;
      const label = totalChunks > 1 ? `Generating chunk ${chunkIndex + 1}/${totalChunks} (${tokenCount.toLocaleString()} tokens)` : `Generating… (${tokenCount.toLocaleString()} tokens)`;
      sendProgress({ stage: 'generating', message: label });
    }
  };
}

// Arc analysis — calls LLM once on a condensed version of the transcript.
// Returns an arc object or null on any failure (non-fatal).
async function analyzeArc(transcript, model, videoContext, signal) {
  try {
    const condensed = condenseTranscript(transcript);
    const req = buildArcRequest(condensed, model, videoContext);
    const result = await generate({ ...req, signal });
    // Validate required percentage fields
    const required = ['staging_end_pct', 'tension_start_pct', 'climax_zone_start_pct', 'climax_zone_end_pct', 'resolution_start_pct'];
    for (const field of required) {
      if (typeof result[field] !== 'number' || result[field] < 0 || result[field] > 1) return null;
    }
    if (!result.arc_shape) return null;
    return result;
  } catch {
    return null;
  }
}

// Arc validation (JS only, no LLM call):
// 1. Enforce climax budget ≤ 15% of thoughts
// 2. Ensure every climax is preceded by building_tension
function validateArc(data) {
  const allThoughts = [];
  for (const section of data.sections || []) {
    for (const thought of section.thoughts || []) {
      allThoughts.push(thought);
    }
  }

  const total = allThoughts.length;
  if (total === 0) return data;

  const maxClimax = Math.ceil(total * 0.15);
  const climaxEntries = allThoughts
    .map((t, i) => ({ i, complexity: t.complexity || 0 }))
    .filter(({ i }) => allThoughts[i].energy === 'climax');

  if (climaxEntries.length > maxClimax) {
    // Keep highest-complexity climax thoughts, downgrade the rest
    climaxEntries.sort((a, b) => b.complexity - a.complexity);
    for (let k = maxClimax; k < climaxEntries.length; k++) {
      allThoughts[climaxEntries[k].i].energy = 'building_tension';
    }
  }

  // Ensure each remaining climax is preceded by building_tension or climax
  for (let i = 1; i < allThoughts.length; i++) {
    if (allThoughts[i].energy === 'climax') {
      const prev = allThoughts[i - 1];
      if (prev.energy !== 'building_tension' && prev.energy !== 'climax') {
        prev.energy = 'building_tension';
      }
    }
  }

  return data;
}

async function processTranscript(transcript, sendProgress, durationSeconds = 0, videoContext = null, signal = null) {
  sendProgress({ stage: 'connecting', message: 'Connecting to Ollama…' });
  const health = await checkHealth();
  if (!health.running) throw new Error('OLLAMA_NOT_RUNNING');
  if (!health.models?.length) throw new Error('NO_MODELS_INSTALLED');

  sendProgress({ stage: 'model_check', message: 'Selecting model…' });
  const model = await getModel();
  if (!model) throw new Error('NO_MODELS_INSTALLED');

  sendProgress({ stage: 'model_check', message: `Loading ${model}…` });
  const resolvedModel = model;

  // Arc analysis pass — non-fatal, degrades gracefully to current behavior
  sendProgress({ stage: 'arc_analysis', message: 'Analyzing narrative arc…' });
  const arcData = await analyzeArc(transcript, resolvedModel, videoContext, signal);

  const wordCount = transcript.split(/\s+/).length;
  const useSinglePass = durationSeconds > 0
    ? durationSeconds <= SINGLE_PASS_DURATION
    : wordCount <= SINGLE_PASS_WORD_LIMIT;

  if (useSinglePass) {
    // Single pass — model sees the full transcript
    sendProgress({ stage: 'generating', message: 'Generating… (0 tokens)', total: 1, completed: 0 });
    const arcContext = buildArcContext(arcData, 0, 1);
    const req = buildRestructureRequest(transcript, resolvedModel, videoContext, arcContext);
    const result = await generate({ ...req, signal, onToken: makeTokenHandler(sendProgress, 0, 1) });
    sendProgress({ stage: 'generating', message: 'Finishing up…', total: 1, completed: 1 });
    return validateArc(validateAndNormalize(result));
  }

  // Long transcript — split on sentence boundaries, process sequentially
  const chunks = splitIntoSentenceChunks(transcript);
  sendProgress({ stage: 'generating', message: `Processing 0/${chunks.length} chunks…`, total: chunks.length, completed: 0 });

  // Compute fractional word-count positions for each chunk
  const chunkWordCounts = chunks.map(c => c.split(/\s+/).length);
  const totalChunkWords = chunkWordCounts.reduce((a, b) => a + b, 0);
  const cumulative = [];
  let cum = 0;
  for (const wc of chunkWordCounts) {
    cumulative.push(cum);
    cum += wc;
  }

  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const startPct = cumulative[i] / totalChunkWords;
    const endPct = (cumulative[i] + chunkWordCounts[i]) / totalChunkWords;
    const arcContext = buildArcContext(arcData, startPct, endPct);
    // Only pass videoContext to the first chunk
    const req = buildRestructureRequest(chunks[i], resolvedModel, i === 0 ? videoContext : null, arcContext);
    const result = await generate({ ...req, signal, onToken: makeTokenHandler(sendProgress, i, chunks.length) });
    results.push(result);
    sendProgress({ stage: 'generating', message: `Processed ${i + 1}/${chunks.length} chunks`, total: chunks.length, completed: i + 1 });
  }

  return validateArc(validateAndNormalize(mergeResults(results)));
}

const VALID_ENERGIES = new Set([
  'calm_intro', 'explanation', 'building_tension', 'climax',
  'enumeration', 'contrast', 'emotional', 'question', 'resolution',
]);
const VALID_MODES = new Set(['flow', 'stack', 'impact']);

function validateAndNormalize(data) {
  if (!data || !Array.isArray(data.sections) || data.sections.length === 0) {
    throw new Error('AI_PROCESSING_FAILED');
  }

  for (const section of data.sections) {
    if (!section.title || typeof section.title !== 'string') {
      throw new Error('AI_PROCESSING_FAILED');
    }
    if (!section.recap || typeof section.recap !== 'string') {
      section.recap = '';
    }
    if (!Array.isArray(section.thoughts) || section.thoughts.length === 0) {
      throw new Error('AI_PROCESSING_FAILED');
    }

    for (const thought of section.thoughts) {
      if (!thought || typeof thought.text !== 'string' || !thought.text.trim()) {
        throw new Error('AI_PROCESSING_FAILED');
      }
      if (!VALID_ENERGIES.has(thought.energy)) {
        thought.energy = 'explanation';
      }
      if (!VALID_MODES.has(thought.mode)) {
        thought.mode = 'flow';
      }
      if (typeof thought.complexity !== 'number' || thought.complexity < 0 || thought.complexity > 1) {
        thought.complexity = Math.min(1, Math.max(0, Number(thought.complexity) || 0.5));
      }
      if (!Array.isArray(thought.emphasis)) {
        thought.emphasis = [];
      }
    }
  }

  if (!Array.isArray(data.takeaways)) {
    data.takeaways = [];
  }

  return data;
}

// Chapter-aware pipeline: process each chapter independently
async function processWithChapters(chapters, sendProgress, signal = null) {
  sendProgress({ stage: 'connecting', message: 'Connecting to Ollama…' });
  const health = await checkHealth();
  if (!health.running) throw new Error('OLLAMA_NOT_RUNNING');
  if (!health.models?.length) throw new Error('NO_MODELS_INSTALLED');

  sendProgress({ stage: 'model_check', message: 'Selecting model…' });
  const model = await getModel();
  if (!model) throw new Error('NO_MODELS_INSTALLED');

  sendProgress({ stage: 'model_check', message: `Loading ${model}…` });
  const resolvedModel = model;

  // Count total LLM calls for progress (chapters may be sub-chunked)
  const chapterChunks = chapters.map(ch => splitChapterIntoSubChunks(ch.text));
  const totalCalls = chapterChunks.reduce((sum, chunks) => sum + chunks.length, 0);
  let completed = 0;
  sendProgress({ stage: 'generating', message: `Processing 0/${totalCalls} chapters…`, total: totalCalls, completed: 0 });

  // Neutral arc for chapter-based context (no extra LLM call — chapter titles define structure)
  const neutralArc = {
    arc_shape: 'rise',
    staging_end_pct: 0.15,
    tension_start_pct: 0.50,
    climax_zone_start_pct: 0.65,
    climax_zone_end_pct: 0.85,
    resolution_start_pct: 0.85,
  };

  const sections = [];
  for (let i = 0; i < chapters.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const chapter = chapters[i];
    const chunks = chapterChunks[i];

    // Derive arc context from chapter's position in the video
    const startPct = chapters.length > 1 ? i / chapters.length : 0;
    const endPct = chapters.length > 1 ? (i + 1) / chapters.length : 1;
    const arcContext = buildArcContext(neutralArc, startPct, endPct);

    if (chunks.length === 1) {
      // Single call for this chapter
      const req = buildChapterRequest(chapter.title, chunks[0], resolvedModel, arcContext);
      const result = await generate({ ...req, signal, onToken: makeTokenHandler(sendProgress, completed, totalCalls) });
      completed++;
      sendProgress({ stage: 'generating', message: `Processed ${completed}/${totalCalls} chapters`, total: totalCalls, completed });

      sections.push({
        title: chapter.title,
        recap: result.recap || '',
        thoughts: result.thoughts || [],
      });
    } else {
      // Sub-chunked chapter — merge thoughts, use last chunk's recap
      const allThoughts = [];
      let recap = '';
      for (const chunk of chunks) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const req = buildChapterRequest(chapter.title, chunk, resolvedModel, arcContext);
        const result = await generate({ ...req, signal, onToken: makeTokenHandler(sendProgress, completed, totalCalls) });
        completed++;
        sendProgress({ stage: 'generating', message: `Processed ${completed}/${totalCalls} chapters`, total: totalCalls, completed });

        if (result.thoughts) allThoughts.push(...result.thoughts);
        if (result.recap) recap = result.recap;
      }

      sections.push({
        title: chapter.title,
        recap,
        thoughts: allThoughts,
      });
    }
  }

  // Derive takeaways from section recaps (chapter pipeline doesn't ask LLM for takeaways)
  const takeaways = sections
    .map(s => s.recap)
    .filter(r => r && r.trim());

  return { sections, takeaways };
}

function mergeResults(results) {
  const merged = { sections: [], takeaways: [] };

  for (const result of results) {
    if (result.sections) {
      merged.sections.push(...result.sections);
    }
  }

  // Takeaways from the last chunk — it has the most complete view
  // but ideally the final chunk covers the conclusion
  const last = results[results.length - 1];
  if (last?.takeaways) {
    merged.takeaways = last.takeaways;
  }

  return merged;
}

// Message handler (short-lived requests only)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'HEALTH_CHECK') {
    checkHealth().then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_MODEL') {
    checkModel(message.model || DEFAULT_MODEL).then(sendResponse);
    return true;
  }

  if (message.type === 'PICK_BEST_MODEL') {
    checkHealth().then(health => {
      if (!health.running || !health.modelDetails?.length) {
        sendResponse({ model: null });
      } else {
        const best = pickBestModel(health.modelDetails);
        sendResponse({ model: best?.name || null });
      }
    });
    return true;
  }
});

// Port-based handler for long-running pipeline (auto-cancels on page unload)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ytpres-pipeline') return;

  const controller = new AbortController();

  port.onDisconnect.addListener(() => {
    controller.abort();
  });

  port.onMessage.addListener((message) => {
    if (message.type !== 'PROCESS_TRANSCRIPT') return;

    const sendProgress = (progress) => {
      try { port.postMessage({ type: 'PROCESSING_PROGRESS', ...progress }); } catch {}
    };

    const pipeline = message.chapters?.length
      ? processWithChapters(message.chapters, sendProgress, controller.signal).then(validateAndNormalize).then(validateArc)
      : processTranscript(message.transcript, sendProgress, message.durationSeconds || 0, message.videoContext || null, controller.signal);

    pipeline
      .then(result => {
        try { port.postMessage({ type: 'RESULT', success: true, data: result }); } catch {}
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          console.log('[YTPresenter] Pipeline aborted (page navigated away)');
          return;
        }
        try { port.postMessage({ type: 'RESULT', success: false, error: err.message }); } catch {}
      });
  });
});
