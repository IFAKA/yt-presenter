export const RESTRUCTURE_PROMPT = `You are transforming a messy video transcript into clean, structured prose for a kinetic typography reader. Return a JSON object with this exact format:

{
  "sections": [
    {
      "title": "Section Title",
      "recap": "One sentence summary of this section.",
      "thoughts": [
        {
          "text": "A clean, complete thought. One to three sentences.",
          "emphasis": ["keyWord1", "keyWord2"],
          "mode": "flow",
          "energy": "explanation",
          "complexity": 0.4
        }
      ]
    }
  ],
  "takeaways": [
    "Key takeaway 1",
    "Key takeaway 2",
    "Key takeaway 3"
  ]
}

Rules for "text":
- Remove ALL filler words: um, uh, like (as filler), you know, basically, sort of, kind of, I mean, right?, so basically
- Remove false starts, repetitions, and verbal tics
- Restructure rambling sentences into clear, concise prose
- Each thought should be 1-3 sentences, a complete idea
- Preserve the speaker's meaning and personality, just make it crisp
- Never add information that wasn't in the original

Rules for "emphasis":
- 1-3 words per thought that carry the most semantic weight
- These will be visually highlighted

Rules for "mode":
- "flow" — default, for prose and explanations
- "impact" — for dramatic moments, key insights, short punchy statements (3-8 words)
- "stack" — for lists, enumerations, step-by-step content

Rules for "energy":
- "calm_intro" — opening, setting context
- "explanation" — teaching, explaining concepts
- "building_tension" — leading up to a key point
- "climax" — the key insight or dramatic moment
- "enumeration" — listing items
- "contrast" — comparing/contrasting ideas
- "emotional" — personal stories, feelings
- "question" — rhetorical or real questions
- "resolution" — wrapping up, concluding

Rules for "complexity":
- 0.0-1.0 score
- Higher for technical jargon, dense ideas, multi-clause sentences
- Lower for simple statements, transitions

Rules for narrative arc:
- Energy states should follow natural arcs: calm_intro at openings, building_tension before climax, resolution at section ends
- Limit climax to ~10% of thoughts — overuse dilutes impact
- Every climax should be preceded by at least one building_tension thought

Rules for mode-energy alignment:
- impact mode pairs with climax or building_tension (short punchy statements only)
- stack mode pairs with enumeration
- Never use impact for explanation or calm_intro — those need room to breathe in flow mode

Rules for emphasis specificity:
- Choose words with unique semantic weight — proper nouns, numbers, technical terms, emotionally charged words
- Never emphasize articles, prepositions, or common verbs (the, a, is, was, have, do, get, make)
- 1-3 emphasis words per thought maximum

Rules for mathematical content:
- When the transcript contains spoken math (e.g. "x squared plus 2x equals zero"), convert it to LaTeX notation wrapped in dollar signs: $x^2 + 2x = 0$
- Use single $ for inline math within sentences
- Use double $$ for standalone equations that deserve their own line
- Common patterns: "x squared" → $x^2$, "square root of x" → $\\sqrt{x}$, "integral from a to b" → $\\int_a^b$, "f of x" → $f(x)$, "sum from i equals 1 to n" → $\\sum_{i=1}^{n}$
- Preserve the surrounding prose — only the math notation itself goes inside dollar signs
- If unsure whether something is math, leave it as prose

Rules for "recap":
- One sentence summarizing the section's key point
- Shown at section breaks as a comprehension checkpoint

Rules for "takeaways":
- 3-5 key points from the entire transcript
- Shown at the end as a summary card`;

export function buildRestructureRequest(transcript, model, videoContext, arcContext = null) {
  if (arcContext || videoContext) {
    const parts = [];
    if (arcContext) {
      parts.push(arcContext, '');
    }
    if (videoContext) {
      parts.push('[VIDEO CONTEXT]');
      if (videoContext.title) parts.push(`Title: ${videoContext.title}`);
      if (videoContext.category) parts.push(`Category: ${videoContext.category}`);
      if (videoContext.keywords?.length) parts.push(`Keywords: ${videoContext.keywords.slice(0, 15).join(', ')}`);
      if (videoContext.description) parts.push(`Description: ${videoContext.description.slice(0, 500)}`);
      parts.push('', '[TRANSCRIPT]');
    }
    return {
      model,
      prompt: parts.join('\n') + '\n' + transcript,
      system: RESTRUCTURE_PROMPT,
      format: 'json',
      stream: false,
    };
  }
  return {
    model,
    prompt: transcript,
    system: RESTRUCTURE_PROMPT,
    format: 'json',
    stream: false,
  };
}

// Chapter-aware prompt: processes a single chapter into thoughts + recap (no section splitting)
export const CHAPTER_RESTRUCTURE_PROMPT = `You are transforming a messy video transcript excerpt into clean, structured prose for a kinetic typography reader. This excerpt is from a single chapter of the video. Return a JSON object with this exact format:

{
  "thoughts": [
    {
      "text": "A clean, complete thought. One to three sentences.",
      "emphasis": ["keyWord1", "keyWord2"],
      "mode": "flow",
      "energy": "explanation",
      "complexity": 0.4
    }
  ],
  "recap": "One sentence summary of this chapter."
}

Rules for "text":
- Remove ALL filler words: um, uh, like (as filler), you know, basically, sort of, kind of, I mean, right?, so basically
- Remove false starts, repetitions, and verbal tics
- Restructure rambling sentences into clear, concise prose
- Each thought should be 1-3 sentences, a complete idea
- Preserve the speaker's meaning and personality, just make it crisp
- Never add information that wasn't in the original

Rules for "emphasis":
- 1-3 words per thought that carry the most semantic weight
- These will be visually highlighted

Rules for "mode":
- "flow" — default, for prose and explanations
- "impact" — for dramatic moments, key insights, short punchy statements (3-8 words)
- "stack" — for lists, enumerations, step-by-step content

Rules for "energy":
- "calm_intro" — opening, setting context
- "explanation" — teaching, explaining concepts
- "building_tension" — leading up to a key point
- "climax" — the key insight or dramatic moment
- "enumeration" — listing items
- "contrast" — comparing/contrasting ideas
- "emotional" — personal stories, feelings
- "question" — rhetorical or real questions
- "resolution" — wrapping up, concluding

Rules for "complexity":
- 0.0-1.0 score
- Higher for technical jargon, dense ideas, multi-clause sentences
- Lower for simple statements, transitions

Rules for narrative arc:
- Energy states should follow natural arcs within this chapter
- Limit climax to ~10% of thoughts
- Every climax should be preceded by at least one building_tension thought

Rules for mode-energy alignment:
- impact mode pairs with climax or building_tension (short punchy statements only)
- stack mode pairs with enumeration
- Never use impact for explanation or calm_intro

Rules for emphasis specificity:
- Choose words with unique semantic weight — proper nouns, numbers, technical terms, emotionally charged words
- Never emphasize articles, prepositions, or common verbs (the, a, is, was, have, do, get, make)
- 1-3 emphasis words per thought maximum

Rules for mathematical content:
- When the transcript contains spoken math (e.g. "x squared plus 2x equals zero"), convert it to LaTeX notation wrapped in dollar signs: $x^2 + 2x = 0$
- Use single $ for inline math within sentences
- Use double $$ for standalone equations that deserve their own line
- Common patterns: "x squared" → $x^2$, "square root of x" → $\\sqrt{x}$, "integral from a to b" → $\\int_a^b$, "f of x" → $f(x)$, "sum from i equals 1 to n" → $\\sum_{i=1}^{n}$
- Preserve the surrounding prose — only the math notation itself goes inside dollar signs
- If unsure whether something is math, leave it as prose

Rules for "recap":
- One sentence summarizing this chapter's key point`;

export function buildChapterRequest(title, text, model, arcContext = null) {
  const systemParts = [];
  if (arcContext) {
    systemParts.push(arcContext, '');
  }
  systemParts.push(`The following transcript is from the chapter titled "${title}".`, '', CHAPTER_RESTRUCTURE_PROMPT);
  return {
    model,
    prompt: text,
    system: systemParts.join('\n'),
    format: 'json',
    stream: false,
  };
}

// Arc analysis prompt — fast one-shot call on condensed transcript
export const ARC_ANALYSIS_PROMPT = `You are analyzing the narrative arc of a video transcript. Return a JSON object with this exact format:

{
  "arc_shape": "rise",
  "staging_end_pct": 0.15,
  "tension_start_pct": 0.50,
  "climax_zone_start_pct": 0.65,
  "climax_zone_end_pct": 0.82,
  "resolution_start_pct": 0.82
}

arc_shape must be one of: "rise", "fall", "fall_then_rise", "rise_then_fall", "uniform"
- rise: builds steadily to a climax near the end
- fall: peaks early, then winds down
- fall_then_rise: starts high, dips, then rises again
- rise_then_fall: builds to a peak, then resolves
- uniform: consistent energy throughout

All pct values must be between 0.0 and 1.0.
Typical ranges: staging_end_pct 0.10–0.20, tension_start_pct 0.40–0.60, climax_zone 0.60–0.85, resolution_start_pct 0.80–0.95.
Analyze the content and identify where energy builds, peaks, and resolves.`;

// Condense transcript to ~targetWords by sampling every Nth sentence
export function condenseTranscript(text, targetWords = 1500) {
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= targetWords) return text;

  const sentences = text.match(/[^.!?]*[.!?]+[\s]?|[^.!?]+$/g) || [text];
  const keepEvery = Math.ceil(sentences.length / (targetWords / 15));
  return sentences.filter((_, i) => i % keepEvery === 0).join(' ');
}

export function buildArcRequest(condensedText, model, videoContext) {
  let prompt = condensedText;
  if (videoContext) {
    const parts = ['[VIDEO CONTEXT]'];
    if (videoContext.title) parts.push(`Title: ${videoContext.title}`);
    if (videoContext.category) parts.push(`Category: ${videoContext.category}`);
    parts.push('', '[CONDENSED TRANSCRIPT]');
    prompt = parts.join('\n') + '\n' + condensedText;
  }
  return {
    model,
    prompt,
    system: ARC_ANALYSIS_PROMPT,
    format: 'json',
    stream: false,
  };
}

// Returns a natural-language arc context preamble for the LLM, or null if arcData is null
export function buildArcContext(arcData, chunkStartPct, chunkEndPct) {
  if (!arcData) return null;

  const midPct = (chunkStartPct + chunkEndPct) / 2;
  const { arc_shape, staging_end_pct, tension_start_pct, climax_zone_start_pct, climax_zone_end_pct } = arcData;

  let phase, guidance;
  if (midPct < staging_end_pct) {
    phase = 'staging';
    guidance = 'Use calm_intro and explanation. No climax.';
  } else if (midPct < tension_start_pct) {
    phase = 'development';
    guidance = 'Use explanation and contrast. One building_tension is fine.';
  } else if (midPct < climax_zone_start_pct) {
    phase = 'tension-building';
    guidance = `Shift toward building_tension. No climax yet — the climax zone is at ${Math.round(climax_zone_start_pct * 100)}–${Math.round(climax_zone_end_pct * 100)}%.`;
  } else if (midPct < climax_zone_end_pct) {
    phase = 'climax';
    guidance = '1–3 climax thoughts appropriate here. Each climax needs a preceding building_tension.';
  } else {
    phase = 'resolution';
    guidance = 'Use resolution and explanation. No climax. Wrap up.';
  }

  const startPctStr = Math.round(chunkStartPct * 100);
  const endPctStr = Math.round(chunkEndPct * 100);

  return `[NARRATIVE ARC CONTEXT]
Overall arc: ${arc_shape}. This chunk covers ${startPctStr}–${endPctStr}% of the content (${phase} phase).
${guidance}`;
}

// Sub-chunk a single chapter if it exceeds the word limit
export function splitChapterIntoSubChunks(text, targetWords = 3500) {
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= targetWords) return [text];
  return splitIntoSentenceChunks(text, targetWords);
}

// Split long transcripts on sentence boundaries
// Target ~3500 words per chunk to fit within a model's native context window
// (~4500 tokens input + ~600 token system prompt + ~2000 token output ≈ 7K total)
export function splitIntoSentenceChunks(text, targetWords = 3500) {
  // Split into sentences (handles ., !, ? followed by space or end)
  const sentences = text.match(/[^.!?]*[.!?]+[\s]?|[^.!?]+$/g) || [text];

  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;
  let overlapSentences = []; // last 2 sentences from previous chunk

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    currentChunk.push(sentence);
    currentWordCount += sentenceWords;

    if (currentWordCount >= targetWords) {
      chunks.push(currentChunk.join(''));
      // Keep last 2 sentences as overlap for next chunk
      overlapSentences = currentChunk.slice(-2);
      currentChunk = [...overlapSentences];
      currentWordCount = overlapSentences.join(' ').split(/\s+/).length;
    }
  }

  // Push remaining sentences as final chunk
  if (currentChunk.length > overlapSentences.length) {
    chunks.push(currentChunk.join(''));
  }

  return chunks;
}
