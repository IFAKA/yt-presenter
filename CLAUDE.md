# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YTPresenter is a Chrome extension (Manifest V3) that transforms YouTube videos into a kinetic typography reading experience. It extracts video captions, optionally restructures them into clean prose via a local Ollama LLM, and presents the text as an animated, timed reading experience that replaces the video player.

## Development

No build step — plain vanilla JavaScript, loaded directly by Chrome. To develop:

1. Open `chrome://extensions`, enable Developer Mode
2. Click "Load unpacked" and select this repo's root directory
3. Navigate to any YouTube video — a "Read" button appears if captions are available

For AI features, Ollama must be running locally (`ollama serve`) with a model pulled (default: `llama3.2`).

Testing is manual via `test.html` (opened as a local file) and the Playwright MCP browser tools.

## Architecture

### Two Content Script Worlds

The extension runs content scripts in two Chrome worlds on YouTube watch pages:

- **MAIN world** (`src/content/main-world.js`): Has access to YouTube's page JS context. Extracts caption tracks from `ytInitialPlayerResponse` / `ytplayer.config` and posts data to the ISOLATED world via `window.postMessage`.
- **ISOLATED world** (all other `src/content/` files): Cannot access page JS but can use `chrome.*` APIs. Runs the full pipeline: transcript fetch → parse → AI/deterministic processing → rendering.

### Global Namespace Pattern

All ISOLATED world modules attach to `window.YTPresenter`. There is no bundler or module system — scripts are loaded in dependency order via `manifest.json`'s content_scripts array. Order matters.

### Pipeline Flow

1. **Transcript extraction**: `main-world.js` → posts `YTPRES_CAPTION_DATA` message
2. **Transcript fetch/parse**: `transcript/extractor.js` fetches json3 format, `parser.js` parses it, `preprocessor.js` provides deterministic fallback
3. **AI processing** (optional): Content script sends `PROCESS_TRANSCRIPT` message to service worker → service worker calls Ollama API with two-pass approach (structural scan + chunked restructuring)
4. **Rendering**: `content.js` orchestrates Timeline → Animator → Layout modes

### Service Worker (`src/background/`)

ES modules (`import`/`export`). Handles:
- Ollama health checks and model verification (`ollama.js`)
- Two-pass LLM pipeline: structure analysis + chunked transcript restructuring (`service-worker.js`, `prompts.js`)
- Sends progress updates back to content script via `chrome.tabs.sendMessage`

### Rendering Engine (`src/content/engine/`)

- **Timeline**: Time-based state machine, calculates display durations from WPM + complexity scores, emits events (`thoughtChange`, `sectionChange`, `end`)
- **Animator**: Coordinates Timeline events with Layout modes
- **Layout**: Three modes — `FlowLayout` (one thought at a time), `StackLayout` (accumulating list), `ImpactLayout` (dramatic single-word emphasis)
- **Effects/Pacing**: CSS animation helpers and adaptive speed controls

### Experience Layer (`src/content/experience/`)

Between-section features: breathing pauses, section recaps, progress celebrations, end-of-video takeaways, ambient background effects.

### Keyboard Shortcuts (active during reading)

Space=play/pause, Arrows=navigate/speed, 1/2/3=layout modes, T=close, F=fullscreen

## Key Data Structures

The AI (or deterministic fallback) produces this shape, consumed by Timeline:

```json
{
  "sections": [{
    "title": "string",
    "recap": "string",
    "thoughts": [{
      "text": "string",
      "emphasis": ["word1"],
      "mode": "flow|impact|stack",
      "energy": "calm_intro|explanation|building_tension|climax|...",
      "complexity": 0.0-1.0
    }]
  }],
  "takeaways": ["string"]
}
```
