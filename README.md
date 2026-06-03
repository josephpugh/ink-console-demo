# 🌤 weather — a rich terminal UI built with Ink

A small conversational weather agent that doubles as a **demo of [Ink](https://github.com/vadimdemedes/ink)** — the React renderer for interactive command-line apps. It shows how much polish you can bring to a plain terminal: gradient banners, chat bubbles, live token-by-token streaming, in-terminal markdown rendering, and interactive permission prompts — all driven by React components.

The agent itself is powered by the [`@github/copilot-sdk`](https://www.npmjs.com/package/@github/copilot-sdk) talking to an OpenAI-compatible model, with two tools: looking up live weather (via [Open-Meteo](https://open-meteo.com/)) and writing markdown files to disk.

## What this demonstrates about Ink

Ink lets you build terminal UIs with the same component model, hooks, and flexbox layout you'd use on the web — but rendered as text. This project leans on:

- **Flexbox layout** (`<Box>`) for a single-column chat transcript with asymmetric indents that hint at "left vs right" speakers.
- **Stateful, reactive rendering** — `useState`/`useEffect` re-render the transcript as streamed tokens arrive.
- **Live streaming** — a blinking cursor and a bubble that grows in real time as the model responds.
- **Rich text** — gradient ASCII art (`ink-gradient` + `ink-big-text`), animated spinners (`ink-spinner`), and ANSI-rendered markdown (`marked` + `marked-terminal`) piped straight into `<Text>`.
- **Keyboard-driven interaction** — `useInput` powers an inline `y/n` permission prompt that pauses the agent before it writes a file.
- **Adaptive sizing** — bubble and markdown widths are derived from the terminal's column count.

## The welcome screen

When you launch the app, Ink renders this:

```
               █ █ █ █▀▀ ▄▀█ ▀█▀ █ █ █▀▀ █▀█
               ▀▄▀▄▀ ██▄ █▀█  █  █▀█ ██▄ █▀▄

          ⛅  your friendly forecast companion  🌤

 ╭──────────────────────────────────────────────────────────╮
 │                                                           │
 │  ✨ Try asking                                            │
 │                                                           │
 │     › What's the weather in Boston?                       │
 │     › Is it raining in Seattle right now?                 │
 │     › Compare Austin and Denver, save to report.md        │
 │                                                           │
 ╰──────────────────────────────────────────────────────────╯

 ╭──────────────────────────────────────────────────────────╮
 │  ❯ Ask about the weather in any US city…                  │
 ╰──────────────────────────────────────────────────────────╯
  ↵ send · type exit or Ctrl+C to quit
```

In a real terminal the banner is a sky-blue gradient, the "Try asking" heading is a warm sunset gradient, and the prompt chevron glows. A few moments later, conversation appears as bordered bubbles — gray for you, blue for the assistant.

## Features

- **Conversational chat UI** with gray (you) and blue (assistant) bordered message bubbles.
- **Token-by-token streaming** — responses fill in live, with a typing cursor, then settle into a formatted bubble.
- **Markdown in the terminal** — assistant replies render headings, bold/italic, lists, code, and blockquotes as styled ANSI.
- **Live weather** for US cities via the free Open-Meteo API (no key required for weather).
- **File-writing tool with a permission gate** — the agent asks for an explicit `y/n` before writing any `.md` file to the current directory.

## Getting started

### Prerequisites

- Node.js 18+
- An API key for an OpenAI-compatible model, exported as `OPENAI_API_KEY` (or `COPILOT_PROVIDER_API_KEY`).

### Install

```bash
npm install
```

### Run

```bash
export OPENAI_API_KEY=sk-...
npm run start
```

Then ask away — e.g. *"What's the weather in Boston?"* or *"Compare Austin and Denver, then save it to report.md"*.

### Scripts

| Script | Description |
| --- | --- |
| `npm run start` | Run the agent (`tsx src/agent.tsx`). |
| `npm run dev` | Run with file-watch reload. |
| `npm run build` | Type-check / compile with `tsc`. |

## How it works

| Concern | Where |
| --- | --- |
| UI, layout, streaming, permission prompt | [`src/agent.tsx`](src/agent.tsx) |
| `get_weather` tool (Open-Meteo geocoding + forecast) | [`src/weather-tool.ts`](src/weather-tool.ts) |
| `write_markdown` tool (sandboxed to the current dir) | [`src/write-file-tool.ts`](src/write-file-tool.ts) |

The model streams `assistant.message_delta` events; the UI appends each chunk to a live bubble and commits the final, markdown-formatted message when the turn ends. Tool calls flow through a custom `onPermissionRequest` handler: weather lookups are auto-approved, while file writes are parked on a promise until you answer the inline `y/n` prompt.

## UI toolkit

| Package | Role |
| --- | --- |
| [`ink`](https://github.com/vadimdemedes/ink) | React renderer for the terminal |
| [`ink-text-input`](https://github.com/vadimdemedes/ink-text-input) | The prompt input field |
| [`ink-gradient`](https://github.com/sindresorhus/ink-gradient) | Gradient coloring for the banner and headings |
| [`ink-big-text`](https://github.com/sindresorhus/ink-big-text) | The ASCII "weather" wordmark |
| [`ink-spinner`](https://github.com/vadimdemedes/ink-spinner) | The "reading the skies…" loading spinner |
| [`marked`](https://github.com/markedjs/marked) + [`marked-terminal`](https://github.com/mikaelbr/marked-terminal) | Render markdown responses as ANSI |

---

Built as a playground for rich terminal UIs with Ink. PRs and experiments welcome.
