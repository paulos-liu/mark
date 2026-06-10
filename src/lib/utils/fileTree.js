/**
 * Build a nested folder/file tree from a flat list of absolute file paths.
 *
 * The deepest directory shared by every path becomes the tree root, so a
 * listing like `search-notes/a.md`, `search-notes/drafts/b.md` produces a
 * single expandable `search-notes` folder containing the files and subfolders.
 *
 * @typedef {{ name: string, type: 'file', path: string }} FileNode
 * @typedef {{ name: string, type: 'folder', path: string, children: TreeNode[] }} FolderNode
 * @typedef {FileNode | FolderNode} TreeNode
 */

/**
 * @param {string[] | null | undefined} paths
 * @returns {{ rootName: string, root: FolderNode }}
 */
export function buildFileTree(paths) {
  const files = (paths ?? []).filter(Boolean).map((p) => p.replace(/\\/g, '/'));
  /** @type {FolderNode} */
  const root = { name: '', type: 'folder', path: '', children: [] };
  if (files.length === 0) return { rootName: '', root };

  const split = files.map((p) => p.split('/').filter(Boolean));

  // Longest run of leading directory segments common to every path
  // (a file's own basename is never part of the shared prefix).
  let common = split[0].slice(0, -1);
  for (let i = 1; i < split.length; i++) {
    const dir = split[i].slice(0, -1);
    let n = 0;
    while (n < common.length && n < dir.length && common[n] === dir[n]) n++;
    common = common.slice(0, n);
  }

  root.name = common.length ? common[common.length - 1] : '';
  root.path = common.length ? '/' + common.join('/') : '';

  for (let f = 0; f < files.length; f++) {
    const rest = split[f].slice(common.length); // trailing segments; last is the filename
    let node = root;
    for (let i = 0; i < rest.length; i++) {
      const seg = rest[i];
      if (i === rest.length - 1) {
        node.children.push({ name: seg, type: 'file', path: files[f] });
      } else {
        let child = /** @type {FolderNode | undefined} */ (
          node.children.find((c) => c.type === 'folder' && c.name === seg)
        );
        if (!child) {
          child = {
            name: seg,
            type: 'folder',
            path: node.path + '/' + seg,
            children: [],
          };
          node.children.push(child);
        }
        node = child;
      }
    }
  }

  sortNode(root);
  return { rootName: root.name, root };
}

/** Sort children folders-first, then alphabetically. Recurses. @param {FolderNode} node */
function sortNode(node) {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) {
    if (c.type === 'folder') sortNode(c);
  }
}
