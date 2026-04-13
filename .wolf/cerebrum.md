# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-10

## User Preferences

- **Read-focused apps**: When building document readers, prioritize reading over editing features. Start with read-only, add editing as secondary phase.

## Key Learnings

- **Project:** Mark — markdown reader, rebuilt with Tauri v2 + Svelte (was native SwiftUI, moved to old/)
- **Tauri v2 + SvelteKit**: `create-tauri-app --template svelte` gives SvelteKit (not plain Svelte). Uses adapter-static for SPA. This is fine for Tauri.
- **Svelte 5 runes**: Stores use `.svelte.js` files with `$state()`. Components use `$props()`, `$derived()`, `$effect()`.
- **Tauri overlay titlebar**: Set `titleBarStyle: "Overlay"`, `hiddenTitle: true`, `trafficLightPosition: {x, y}` in tauri.conf.json. Need a `data-tauri-drag-region` div for window dragging.
- **Tauri plugins (v2)**: Install both npm package AND Rust crate. Register in `src-tauri/src/lib.rs` with `.plugin()`. Define permissions in `capabilities/default.json`.
- **Heading extraction**: Stack-based algorithm ported from Swift. Line-by-line parse of `#` headings, build hierarchy via stack pop/push.
- **Search highlighting**: DOM TreeWalker to find text nodes, wrap matches in `<mark>` elements. Safer than regex on HTML strings.
- **Markdown rendering**: `marked` library with custom heading renderer to add `id` attributes for scroll-to-anchor.
- **Tauri v2 fs scope**: `fs:read-all` enables the command but does NOT allow all paths. Must add `{ "path": "/**" }` to `fs:scope` allow list in capabilities for a file reader app.
- **Tauri CLI tool pattern**: Use `std::env::args()` in Rust `run()`, store in `Mutex<Option<String>>` state, expose via `get_pending_file` command. Frontend calls `invoke('get_pending_file')` on mount.
- **Svelte 5 `<svelte:self>` deprecated**: Use self-import (`import HeadingRow from './HeadingRow.svelte'`) instead.
- **Titlebar drag region blocks clicks**: Fixed div with `data-tauri-drag-region` at z-index 100 intercepts clicks on elements below it. Move interactive elements (search bar) to bottom of content area.
- **CSS box-sizing in flex layouts**: When using `height: 100%` + `padding-top`, must add `box-sizing: border-box` or the padding overflows and clips bottom content.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

## Decision Log

- **macOS Traffic Light Inlining (2026-04-10)**: `.hiddenTitleBar` keeps traffic lights in system z-order (70pt offset from content). To truly inline them like Notes.app, use `NSWindowStyleMask.fullSizeContentView + titlebarAppearsTransparent + titleVisibility.hidden` via AppKit config. Minimal integration (window setup only), not ongoing AppKit usage.
- **Tauri + Svelte Rebuild (2026-04-13)**: User decided to rebuild from SwiftUI to Tauri v2 + Svelte. Reason: Claude is much stronger with web technologies than native macOS/SwiftUI, enabling faster iteration. All Swift code moved to `old/` for reference.
