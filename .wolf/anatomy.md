# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-06-10T19:42:53.492Z
> Files: 68 tracked | Anatomy hits: 0 | Misses: 0

## ../../.claude/plans/

- `luminous-stirring-bengio.md` — Mark: Tauri v2 + Svelte Rebuild (~1862 tok)
- `refactored-jumping-scott.md` — Inline Traffic Lights + Header Plan (~2860 tok)
- `ticklish-spinning-dongarra.md` — Plan: Bigger Drag Region + macOS Native Menu Bar (~971 tok)

## ../../.config/goose/

- `config.yaml` (~1162 tok)

## ./

- `.gitignore` — Git ignore rules (~71 tok)
- `CLAUDE.md` — OpenWolf (~57 tok)
- `package.json` — Node.js package manifest (~290 tok)
- `playwright.config.js` (~114 tok)
- `test-all-features.md` — Mark Feature Test (~1449 tok)
- `test-document.md` — Getting Started with Mark (~199 tok)
- `vitest.config.js` — /*.test.js'], (~73 tok)

## .claude/

- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .claude/worktrees/cli-autocomplete/src-tauri/src/

- `lib.rs` — Build a CLI launcher script. Escapes the path for safe shell embedding. (~2900 tok)

## .claude/worktrees/cli-autocomplete/src/lib/components/

- `SettingsDialog.svelte` — Svelte: SettingsDialog (~2628 tok)

## Mark/

- `icon.svg` (~99 tok)
- `project.yml` (~181 tok)

## Mark/Mark/

- `Info.plist` (~338 tok)
- `MarkApp.swift` — Struct: MarkApp (~82 tok)

## Mark/Mark/Models/

- `Heading.swift` — Struct: Heading (~133 tok)
- `MarkdownProcessor.swift` — Mutable wrapper for building heading hierarchy (~845 tok)

## Mark/Mark/Views/

- `MarkdownDocument.swift` — Struct: MarkdownDocument (~270 tok)
- `MarkdownEditorView.swift` — SwiftUI view: MarkdownEditorView (~1837 tok)
- `TableOfContentsView.swift` — SwiftUI view: TableOfContentsView (~738 tok)
- `WindowAccessor.swift` — Struct: WindowAccessor (~135 tok)

## src-tauri/

- `Cargo.toml` — Rust package manifest (~135 tok)
- `tauri.conf.json` (~350 tok)

## src-tauri/capabilities/

- `default.json` (~178 tok)

## src-tauri/src/

- `lib.rs` — Build a CLI launcher script. Escapes the path for safe shell embedding. (~4836 tok)
- `main.rs` — Prevents additional console window on Windows in release, DO NOT REMOVE!! (~48 tok)

## src/

- `app.html` — Mark (~215 tok)

## src/lib/components/

- `DirectoryBrowser.svelte` — Svelte: DirectoryBrowser (~318 tok)
- `FileTreeNode.svelte` — Svelte: FileTreeNode (~943 tok)
- `FloatingTocButton.svelte` — Svelte: FloatingTocButton (~418 tok)
- `HeadingRow.svelte` — Svelte: HeadingRow (~479 tok)
- `MarkdownEditor.svelte` — Svelte: MarkdownEditor (~445 tok)
- `MarkdownViewer.svelte` — Svelte: MarkdownViewer (~5090 tok)
- `QuickOpen.svelte` — Svelte: QuickOpen (~1775 tok)
- `SearchBar.svelte` — Svelte: SearchBar (~1029 tok)
- `SettingsDialog.svelte` — Svelte: SettingsDialog (~4214 tok)
- `TableOfContents.svelte` — Svelte: TableOfContents (~1150 tok)
- `Titlebar.svelte` — Svelte: Titlebar (~20 tok)

## src/lib/stores/

- `document.svelte.js` — Exports documentState, loadDocument (~461 tok)
- `editor.svelte.js` — Exports editorState, enterEditMode, exitEditMode, hasUnsavedChanges, markSaved (~160 tok)
- `recents.svelte.js` — Exports recentFiles, addRecent (~214 tok)
- `recents.test.js` — Provide a full localStorage mock (~405 tok)
- `scrollMemory.js` — Exports getScrollPosition, saveScrollPosition (~330 tok)
- `scrollMemory.test.js` — Provide a full localStorage mock (happy-dom's implementation is incomplete) (~509 tok)
- `search.svelte.js` — Maximum number of matches to track to prevent UI freezing (~363 tok)
- `settings.svelte.js` — Normalize persisted values from older versions so every consumer (~555 tok)
- `ui.svelte.js` — Exports uiState (~16 tok)

## src/lib/themes/

- `presets.js` — A few real VS Code color themes, in the same shape VS Code ships them (~1083 tok)

## src/lib/utils/

- `fileHandler.js` — Open a file dialog and return the selected file's content and path. (~464 tok)
- `fileTree.js` — Build a nested folder/file tree from a flat list of absolute file paths. (~755 tok)
- `fileTree.test.js` — Declares drafts (~596 tok)
- `frontmatter.js` — Parse and strip YAML frontmatter from markdown content. (~424 tok)
- `frontmatter.test.js` — Declares doc (~631 tok)
- `headings.js` — Heading extraction and hierarchy building. (~916 tok)
- `headings.test.js` — Declares md (~646 tok)
- `markdown.js` — Exports renderMarkdown (~800 tok)
- `markdown.test.js` — Declares html (~535 tok)
- `vscodeTheme.js` — Parse a VS Code color theme (JSON / JSONC) and map it onto Mark's CSS (~1798 tok)
- `vscodeTheme.test.js` — Declares src (~964 tok)

## src/routes/

- `+page.svelte` — Svelte: +page (~10094 tok)

## tests/

- `debug.spec.js` — Declares sidebarInfo (~408 tok)
- `features.spec.js` — Declares BASE (~1298 tok)
- `mark.spec.js` — Declares BASE (~2959 tok)
- `review.spec.js` — Load markdown content into the viewer via the dev test hook. (~1187 tok)
