import { describe, it, expect, beforeEach } from 'vitest';
import { documentState, applyContent } from './document.svelte.js';
import {
  editorState,
  enterEditMode,
  exitEditMode,
  setBuffer,
  markSaved,
  hasUnsavedChanges,
  resetEditor,
} from './editor.svelte.js';

const RAW = '---\ntitle: Hello\n---\n# Heading\n\nBody **bold** text.';

beforeEach(() => {
  applyContent(RAW);
  resetEditor();
});

describe('applyContent round-trip', () => {
  it('keeps the full raw text (frontmatter included)', () => {
    expect(documentState.raw).toBe(RAW);
  });

  it('strips frontmatter from the rendered body', () => {
    expect(documentState.content).toContain('# Heading');
    expect(documentState.content).not.toContain('title: Hello');
    expect(documentState.frontmatter.title).toBe('Hello');
  });

  it('renders html and extracts headings from the body', () => {
    expect(documentState.html).toContain('<h1');
    expect(documentState.headings.map((h) => h.text)).toContain('Heading');
  });
});

describe('editor store', () => {
  it('starts in read mode, clean', () => {
    expect(editorState.mode).toBe('read');
    expect(editorState.dirty).toBe(false);
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('enterEditMode seeds the buffer from raw and stays clean', () => {
    enterEditMode();
    expect(editorState.mode).toBe('edit');
    expect(editorState.buffer).toBe(RAW);
    expect(editorState.dirty).toBe(false);
  });

  it('setBuffer marks dirty only when content diverges from raw', () => {
    enterEditMode();
    setBuffer(RAW + '\nmore');
    expect(editorState.dirty).toBe(true);
    expect(hasUnsavedChanges()).toBe(true);
    // Returning to the original content clears the dirty flag.
    setBuffer(RAW);
    expect(editorState.dirty).toBe(false);
  });

  it('markSaved clears the dirty flag', () => {
    enterEditMode();
    setBuffer('# Changed\n\nnew');
    markSaved();
    expect(editorState.dirty).toBe(false);
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('exitEditMode re-renders the document from a dirty buffer', () => {
    enterEditMode();
    setBuffer('# Edited Title\n\nedited body');
    exitEditMode();
    expect(editorState.mode).toBe('read');
    expect(documentState.raw).toBe('# Edited Title\n\nedited body');
    expect(documentState.html).toContain('Edited Title');
  });

  it('exitEditMode leaves the document untouched when not dirty', () => {
    enterEditMode();
    exitEditMode();
    expect(documentState.raw).toBe(RAW);
  });

  it('hasUnsavedChanges is false in read mode even if a dirty flag lingers', () => {
    enterEditMode();
    setBuffer('# x');
    exitEditMode(); // back to read, dirty may persist
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('resetEditor returns to a clean read state', () => {
    enterEditMode();
    setBuffer('# y');
    resetEditor();
    expect(editorState.mode).toBe('read');
    expect(editorState.buffer).toBe('');
    expect(editorState.dirty).toBe(false);
  });
});
