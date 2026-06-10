# Mark

A fast, beautiful Markdown reader for macOS.

Mark is a native desktop app built with [Tauri](https://tauri.app) and [SvelteKit](https://kit.svelte.dev). It renders Markdown with GitHub-flavored styling, math, diagrams, and a live table of contents — designed to be a clean, distraction-free way to read documentation and notes.

## Features

- **GitHub-flavored Markdown** rendering with sanitized HTML output (`marked` + `DOMPurify` + `github-markdown-css`)
- **Math** typesetting via [KaTeX](https://katex.org)
- **Diagrams** via [Mermaid](https://mermaid.js.org), theme-aware
- **Table of contents** generated from headings, with scroll syncing
- **File tree / folder browsing** — open a folder and navigate its Markdown files in a sidebar
- **Quick Open** fuzzy file switcher
- **In-document search** with match highlighting and next/previous navigation
- **Recent files** and per-document **scroll memory**
- **YAML frontmatter** parsing
- **Light / dark themes** plus **VS Code theme import** — drop in a VS Code color theme and Mark maps it onto the UI
- **Custom CSS injection** and adjustable font size / zoom
- **Export to PDF**
- **Live reload** — re-renders when the open file changes on disk
- **Native macOS chrome** — overlay title bar, file associations for `.md` / `.markdown`

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘O` | Open file |
| `⌘⇧O` | Open folder |
| `⌘P` | Quick Open |
| `⌘F` | Find in document |
| `⌘\` | Toggle sidebar / table of contents |
| `⌘,` | Settings |
| `⌘⇧E` | Export to PDF |
| `⌘A` | Select all (in viewer) |
| `Esc` | Close dialog / clear search |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (18+)
- [Rust](https://www.rust-lang.org/tools/install) and the platform toolchain required by [Tauri](https://tauri.app/start/prerequisites/)

### Install

```bash
npm install
```

### Develop

Run the app in development with hot reload:

```bash
npm run tauri dev
```

To work on the frontend alone in the browser:

```bash
npm run dev
```

### Build

Produce a distributable macOS app and `.dmg`:

```bash
npm run tauri build
```

## Testing

Unit tests run with [Vitest](https://vitest.dev):

```bash
npm test          # run once
npm run test:watch
```

End-to-end tests run with [Playwright](https://playwright.dev):

```bash
npx playwright test
```

## Project Structure

```
src/
  routes/+page.svelte     # Main app shell, keyboard shortcuts, layout
  lib/
    components/           # Svelte UI (viewer, TOC, file tree, search, settings)
    stores/               # App state (document, settings, search, recents)
    utils/                # Markdown rendering, headings, frontmatter, theming
    themes/               # Built-in theme presets
src-tauri/                # Rust backend, Tauri config, native integration
tests/                    # Playwright end-to-end specs
```

## Tech Stack

- **Frontend:** Svelte 5 + SvelteKit (static adapter), Vite
- **Backend / shell:** Tauri v2 (Rust)
- **Markdown:** marked, DOMPurify, github-markdown-css, KaTeX, Mermaid

## License

MIT
