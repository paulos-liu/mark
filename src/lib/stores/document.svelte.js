import { extractHeadings } from '../utils/headings.js';
import { renderMarkdown } from '../utils/markdown.js';

export const documentState = $state({
  content: '',
  html: '',
  headings: [],
  filePath: '',
  fileName: '',
  loading: false,
});

export async function loadDocument(content, filePath, fileName) {
  documentState.loading = true;
  documentState.fileName = fileName;
  documentState.filePath = filePath;

  // Clear old content so the spinner shows
  documentState.content = '';
  documentState.html = '';
  documentState.headings = [];

  // Double rAF to ensure the spinner actually paints
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    documentState.content = content;
    documentState.html = renderMarkdown(content);
    documentState.headings = extractHeadings(content);
  } catch (/** @type {any} */ err) {
    console.error('Failed to process document:', err);
    documentState.content = content;
    documentState.html = `<p style="color: red;">Failed to render document: ${err?.message ?? 'Unknown error'}</p>`;
    documentState.headings = [];
  } finally {
    documentState.loading = false;
  }
}

export function clearDocument() {
  documentState.content = '';
  documentState.html = '';
  documentState.headings = [];
  documentState.filePath = '';
  documentState.fileName = '';
  documentState.loading = false;
}
