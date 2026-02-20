/**
 * Content-related types for modules, pages, and documents
 */

/** Module info exported by user modules */
export interface ModuleInfo {
  displayName?: string;
  type?: 'auto' | 'dynamic';
  content?: string;
  style?: string;
}

/** Module instance lifecycle interface */
export interface ModuleInstance {
  /** Render the module to a container */
  render(container: HTMLElement, props: ModuleProps): void;
  /** Cleanup when module is unloaded */
  destroy?(): void;
  /** Handle theme changes */
  onThemeChange?(theme: 'dark' | 'light'): void;
}

/** Props passed to module factory functions */
export interface ModuleProps {
  container: HTMLElement;
  themeController: ThemeController;
}

/** Theme controller interface for modules */
export interface ThemeController {
  getCurrentTheme(): 'dark' | 'light';
  subscribe(callback: (theme: 'dark' | 'light') => void): () => void;
  toggleTheme(): void;
}

/** Module layer - determines security context */
export type ModuleLayer = 'USER' | 'PLATFORM';

/** Render type for modules */
export type RenderType = 'auto' | 'dynamic';

/** Content loading state */
export interface ContentState {
  isLoading: boolean;
  error: string | null;
}
