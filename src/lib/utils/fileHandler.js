import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

/**
 * Open a file dialog and return the selected file's content and path.
 * @returns {Promise<{content: string, filePath: string, fileName: string} | null>}
 */
export async function openMarkdownFile() {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
    ],
  });

  if (!selected) return null;

  const filePath = selected;
  const content = await readTextFile(filePath);
  const fileName = filePath.split('/').pop() || 'Untitled';

  return { content, filePath, fileName };
}

/**
 * Open a folder-picker dialog and return the chosen directory path.
 * @returns {Promise<string | null>}
 */
export async function openFolderDialog() {
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === 'string' ? selected : null;
}

/**
 * Read a file by its path.
 * Validates the path is non-empty and handles read errors with descriptive messages.
 * @param {string} filePath
 * @returns {Promise<{content: string, filePath: string, fileName: string}>}
 */
export async function readFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }

  let content;
  try {
    content = await readTextFile(filePath);
  } catch (/** @type {any} */ err) {
    throw new Error(`Could not read file "${filePath}": ${err?.message ?? err}`);
  }

  const fileName = filePath.split('/').pop() || 'Untitled';
  return { content, filePath, fileName };
}
