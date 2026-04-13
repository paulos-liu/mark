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

  documentState.content = content;
  documentState.html = renderMarkdown(content);
  documentState.headings = extractHeadings(content);
  documentState.loading = false;
}

export function clearDocument() {
  documentState.content = '';
  documentState.html = '';
  documentState.headings = [];
  documentState.filePath = '';
  documentState.fileName = '';
  documentState.loading = false;
}
