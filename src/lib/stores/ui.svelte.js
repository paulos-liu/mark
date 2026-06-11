import { settings } from './settings.svelte.js';

export const uiState = $state({
  showTOC: settings.sidebarOnStart ?? false,
});
