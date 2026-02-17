/**
 * Global type declarations
 */

// SES Compartment type (from lockdown)
declare class Compartment {
  constructor(globals: Record<string, unknown>);
  evaluate(code: string): unknown;
}

// Tauri global (available when running in Tauri context)
interface Window {
  __TAURI__?: {
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    event: {
      listen: (event: string, handler: (payload: unknown) => void) => Promise<() => void>;
      emit: (event: string, payload?: unknown) => Promise<void>;
    };
  };
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
