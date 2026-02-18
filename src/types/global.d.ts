/**
 * Global type declarations
 */

// Note: SES Compartment is NOT used for user modules.
// User modules in /Home/Tools/ are TRUSTED (user's own code).
// SES will only be used for community plugins (Plugin Layer) in the future.

// Tauri global (available when running in Tauri context)
interface Window {
  __TAURI__?: {
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    event: {
      listen: (event: string, handler: (payload: unknown) => void) => Promise<() => void>;
      emit: (event: string, payload?: unknown) => Promise<void>;
    };
  };
  // Note: MathJax type is declared in src/loaders/useMathJax.ts
}

// Module factory pattern used by user modules
interface ModuleFactory {
  (options: { container: HTMLElement; themeController: ThemeControllerInterface }): {
    render?: (container: HTMLElement, props: unknown) => void;
    destroy?: () => void;
    onThemeChange?: (theme: 'dark' | 'light') => void;
  };
}

interface ThemeControllerInterface {
  getCurrentTheme(): 'dark' | 'light';
  subscribe(callback: (theme: 'dark' | 'light') => void): () => void;
}
