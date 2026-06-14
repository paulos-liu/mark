import { documentState, applyContent } from './document.svelte.js';

/**
 * Edit-mode state for the Read ↔ Edit toggle.
 * `buffer` holds the full raw file text being edited (frontmatter included);
 * `dirty` is true when it diverges from what's loaded in `documentState.raw`.
 */
export const editorState = $state({
  /** @type {'read' | 'edit'} */
  mode: 'read',
  buffer: '',
  dirty: false,
  saving: false,
});

/** Enter edit mode, seeding the buffer from the loaded document. */
export function enterEditMode() {
  editorState.buffer = documentState.raw;
  editorState.dirty = false;
  editorState.mode = 'edit';
}

/**
 * Leave edit mode and return to the rendered reading view. Re-renders from the
 * current buffer (no spinner) so the reader reflects unsaved edits, matching
 * Obsidian's toggle behaviour. Does not touch disk or the dirty flag.
 */
export function exitEditMode() {
  if (editorState.dirty) applyContent(editorState.buffer);
  editorState.mode = 'read';
}

/**
 * Update the buffer and recompute the dirty flag against the loaded document.
 * @param {string} value
 */
export function setBuffer(value) {
  editorState.buffer = value;
  editorState.dirty = value !== documentState.raw;
}

/** Mark the buffer as clean (call after a successful save). */
export function markSaved() {
  editorState.dirty = false;
}

/** @returns {boolean} whether there are unsaved edits. */
export function hasUnsavedChanges() {
  return editorState.mode === 'edit' && editorState.dirty;
}

/** Reset to a clean reading state (e.g. when loading a different document). */
export function resetEditor() {
  editorState.mode = 'read';
  editorState.buffer = '';
  editorState.dirty = false;
  editorState.saving = false;
}
