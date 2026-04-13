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
 * Read a file by its path.
 * @param {string} filePath
 * @returns {Promise<{content: string, filePath: string, fileName: string}>}
 */
export async function readFile(filePath) {
  const content = await readTextFile(filePath);
  const fileName = filePath.split('/').pop() || 'Untitled';
  return { content, filePath, fileName };
}
