# YTPresenter

A Chrome extension that transforms YouTube videos into a kinetic typography reading experience. It extracts captions, uses a local LLM to restructure them into clean prose, and presents the text as a timed, animated reading experience that replaces the video player.

No cloud APIs. Everything runs locally via [Ollama](https://ollama.com).

---

## Quick start

1. Install and run Ollama: `ollama serve`
2. Pull a model: `ollama pull qwen2.5:7b` (or any model you prefer)
3. Open `chrome://extensions`, enable **Developer Mode**
4. Click **Load unpacked** and select this repo's root directory
5. Navigate to any YouTube video — a **Read** button appears near the player if captions are available

No build step. Plain vanilla JavaScript, loaded directly by Chrome.

---

## How the AI pipeline works

When you click **Read**, the extension runs a three-pass pipeline to turn the raw transcript into a structured reading experience.

### Pass 1 — Arc analysis

Before touching the transcript content, the pipeline asks the LLM a single question: *what is the shape of this talk?*

To keep this fast, the transcript is first condensed to ~1500 words by sampling every Nth sentence. The LLM returns a small JSON object describing the narrative arc:

```json
{
  "arc_shape": "rise_then_fall",
  "staging_end_pct": 0.15,
  "tension_start_pct": 0.50,
  "climax_zone_start_pct": 0.65,
  "climax_zone_end_pct": 0.82,
  "resolution_start_pct": 0.82
}
```

This tells us where in the video the energy builds, peaks, and resolves — as fractional positions (0.0–1.0) through the total content.

**This pass is non-fatal.** If it fails for any reason (Ollama timeout, bad JSON, etc.), the pipeline continues without arc context and behaves exactly like before.

### Pass 2 — Restructuring with arc context

This is the main pass. The transcript is split into chunks (~3500 words each) and each chunk is sent to the LLM for restructuring: filler words removed, sentences cleaned up, each thought annotated with `energy`, `mode`, `complexity`, and `emphasis` words.

What's new: every chunk now receives a **narrative arc context preamble** computed from Pass 1. For example, a chunk covering 40–60% of the content in a `rise_then_fall` arc gets:

```
[NARRATIVE ARC CONTEXT]
Overall arc: rise_then_fall. This chunk covers 40–60% of the content (tension-building phase).
Shift toward building_tension. No climax yet — the climax zone is at 65–82%.
```

This means the LLM annotates energy states relationally — a `climax` only appears where the arc actually peaks, not scattered arbitrarily across the video.

For **chapter-based videos** (videos with YouTube chapters), no arc analysis LLM call is made — the chapter position itself provides the context. Chapter 0 gets staging context, the last chapter gets resolution context, and the rest are interpolated. This makes the chapter pipeline faster.

### Pass 3 — Arc validation (JS only, no LLM call)

After all chunks are merged, a JavaScript post-processing step enforces two rules:

1. **Climax budget**: at most 15% of all thoughts can be `climax`. If the LLM went over, excess climax thoughts (lowest complexity first) are downgraded to `building_tension`.
2. **Climax precedence**: every `climax` thought must be preceded by a `building_tension` thought. If it isn't, the preceding thought's energy is promoted to `building_tension`.

These rules hold regardless of whether Pass 1 succeeded — they're always applied.

---

## Rendering

Each thought has a **display duration** calculated from word count, reading speed (WPM), and two multipliers:

- **Complexity** (0–1): denser thoughts get more time
- **Energy**: each energy state has a timing multiplier

| Energy | Multiplier | Rationale |
|---|---|---|
| `climax` | ×1.4 | Let the moment land |
| `emotional` | ×1.3 | Give it room to breathe |
| `calm_intro` | ×1.3 | Setup deserves space |
| `question` | ×1.15 | Let the question sit |
| `resolution` | ×1.15 | Conclusions need settling time |
| `building_tension` | ×0.9 | Faster pace builds urgency |
| `enumeration` | ×0.85 | Lists move quickly |

Three layout modes are available during reading (keys `1` / `2` / `3`):
- **Flow** — one thought at a time, default
- **Stack** — thoughts accumulate as a list
- **Impact** — dramatic single-word emphasis for punchy moments

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `←` / `→` | Previous / next thought |
| `↑` / `↓` | Speed up / slow down |
| `1` / `2` / `3` | Switch layout mode |
| `F` | Fullscreen |
| `T` | Close reader |

---

## Architecture overview

```
src/
  background/
    service-worker.js   # Pipeline orchestration (three-pass LLM)
    prompts.js          # All prompt templates + arc helpers
    ollama.js           # Ollama health checks, model management
  content/
    main-world.js       # Runs in MAIN world — extracts caption data from YouTube's JS
    content.js          # ISOLATED world entry — orchestrates everything
    transcript/         # Fetch + parse + preprocess captions
    engine/
      timeline.js       # Time-based state machine
      animator.js       # Connects timeline events to layout
      layout/           # FlowLayout, StackLayout, ImpactLayout
    experience/         # Breathing pauses, recaps, takeaways, ambient effects
    ui/                 # Loading screen, controls bar, popup
```

The extension runs in two Chrome content script worlds. The **MAIN world** has access to YouTube's page JavaScript and extracts caption track URLs. The **ISOLATED world** runs everything else and has access to `chrome.*` APIs. They communicate via `window.postMessage`.

---

## Settings

One user-facing setting lives in `chrome.storage.local`:

- **`wpm`** — reading speed in words per minute (default: 250, configurable from the popup)
