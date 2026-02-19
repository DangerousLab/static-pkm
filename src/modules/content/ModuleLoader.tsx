import { useEffect, useRef } from 'react';
import { useThemeStore, type Theme } from '@core/state/themeStore';
import { useMathJax } from '@/loaders';
import type { ModuleNode } from '@/types/navigation';

interface ModuleLoaderProps {
  node: ModuleNode;
  onError: (error: string) => void;
}

/** Module instance interface returned by factory functions */
interface ModuleInstance {
  destroy?: () => void;
  onThemeChange?: (theme: Theme) => void;
  getState?: () => unknown;
  setState?: (state: unknown) => void;
}

/**
 * Module loader component
 * Handles loading and rendering of user JavaScript modules
 * Creates its own container element and manages the module lifecycle
 */
function ModuleLoader({ node, onError }: ModuleLoaderProps): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  // Load MathJax (hook ensures it's loaded before modules use dynamicRender)
  useMathJax();
  const moduleInstanceRef = useRef<ModuleInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  console.log('[DEBUG] [ModuleLoader] Component rendering for:', node.id);

  // Load and render module
  useEffect(() => {
    console.log('[DEBUG] [ModuleLoader] useEffect STARTING for:', node.id);
    console.log('[DEBUG] [ModuleLoader] containerRef.current:', containerRef.current);

    const containerElement = containerRef.current;
    if (!containerElement) {
      console.error('[ERROR] [ModuleLoader] Container ref not available at effect start');
      return;
    }

    console.log('[DEBUG] [ModuleLoader] Container element found');
    console.log('[DEBUG] [ModuleLoader] Container isConnected:', containerElement.isConnected);
    console.log('[DEBUG] [ModuleLoader] Container parentElement:', containerElement.parentElement?.tagName);

    let cancelled = false;
    let currentInstance: ModuleInstance | null = null;

    async function loadModule(): Promise<void> {
      console.log('[DEBUG] [ModuleLoader] loadModule() called, cancelled:', cancelled);

      if (!containerElement) {
        console.error('[ERROR] [ModuleLoader] Container lost during loadModule');
        return;
      }

      // Clear container before loading new module
      console.log('[DEBUG] [ModuleLoader] Clearing container innerHTML');
      containerElement.innerHTML = '';

      try {
        console.log('[INFO] [ModuleLoader] Loading module:', node.id, 'from', node.file);

        // Get factory name from module ID
        const factoryName = getFactoryName(node.id);
        console.log('[INFO] [ModuleLoader] Looking for factory:', factoryName);

        // Check if factory already exists (script might be cached)
        let factory = (window as unknown as Record<string, unknown>)[factoryName];
        console.log('[DEBUG] [ModuleLoader] Factory on window:', typeof factory);

        if (typeof factory !== 'function') {
          // Need to load the script
          console.log('[INFO] [ModuleLoader] Factory not found, loading script...');

          // Build proper script URL (relative to root)
          const scriptSrc = './' + node.file;
          console.log('[DEBUG] [ModuleLoader] Script URL:', scriptSrc);

          // Create a promise that resolves when script loads and executes
          factory = await loadScript(scriptSrc, factoryName);
          console.log('[DEBUG] [ModuleLoader] Script loaded, factory type:', typeof factory);
        }

        if (cancelled) {
          console.log('[DEBUG] [ModuleLoader] Cancelled after script load, returning');
          return;
        }

        if (typeof factory !== 'function') {
          throw new Error(`Module factory '${factoryName}' not found on window after script load`);
        }

        console.log('[INFO] [ModuleLoader] Calling factory:', factoryName);
        console.log('[DEBUG] [ModuleLoader] Container before factory call:');
        console.log('[DEBUG] [ModuleLoader]   - isConnected:', containerElement.isConnected);
        console.log('[DEBUG] [ModuleLoader]   - innerHTML length:', containerElement.innerHTML.length);
        console.log('[DEBUG] [ModuleLoader]   - parentElement:', containerElement.parentElement?.tagName);

        // Create module instance with options
        const instance = factory({
          container: containerElement,
          themeController: {
            getCurrentTheme: () => useThemeStore.getState().theme,
            subscribe: (callback: (theme: Theme) => void) => {
              return useThemeStore.subscribe((state) => callback(state.theme));
            },
          },
          /**
           * Re-render passive content after dynamic DOM updates
           * Assumes libraries are already loaded (use after initial autoRender)
           * For user modules that update innerHTML dynamically
           *
           * MathJax 3 pattern for re-rendering:
           * 1. Call typesetClear() to reset processing state
           * 2. Call typesetPromise() to re-process the content
           */
          dynamicRender: async (container: HTMLElement) => {
            if (!container) return;

            console.log('[Loader] Dynamic re-render...');

            // MathJax is already loaded from initial autoRender
            if (window.MathJax?.typesetPromise) {
              // CRITICAL for re-rendering: Clear MathJax's memory of already-processed elements
              // Without this, MathJax skips re-processing and nothing updates
              if (typeof (window.MathJax as any).typesetClear === 'function') {
                (window.MathJax as any).typesetClear([container]);
                console.log('[Loader] MathJax state cleared for re-rendering');
              }

              // Now re-typeset with fresh state
              await window.MathJax.typesetPromise([container]);
              console.log('[Loader] Dynamic re-render complete');
            }

            // Icons don't need re-rendering (CSS-based, no JS needed after load)
            // Add other library re-renders here if needed in future
          },
          // MathJax API
          mathAPI: {
            clearMath: () => {
              // MathJax 3 doesn't need explicit cleanup for re-typesetting
              // The typeset function handles it automatically
              console.log('[INFO] [ModuleLoader] mathAPI.clearMath() called (no-op for MathJax 3)');
            },
          },
        }) as ModuleInstance;

        console.log('[DEBUG] [ModuleLoader] Factory returned, instance:', !!instance);
        console.log('[DEBUG] [ModuleLoader] Container after factory call:');
        console.log('[DEBUG] [ModuleLoader]   - isConnected:', containerElement.isConnected);
        console.log('[DEBUG] [ModuleLoader]   - innerHTML length:', containerElement.innerHTML.length);
        console.log('[DEBUG] [ModuleLoader]   - children count:', containerElement.children.length);
        console.log('[DEBUG] [ModuleLoader]   - innerHTML preview:', containerElement.innerHTML.substring(0, 200));

        if (cancelled) {
          console.log('[DEBUG] [ModuleLoader] Cancelled after factory, destroying instance');
          // If cancelled during factory execution, destroy immediately
          if (instance?.destroy) {
            try {
              instance.destroy();
            } catch (err) {
              console.error('[ERROR] [ModuleLoader] Error destroying cancelled module:', err);
            }
          }
          return;
        }

        currentInstance = instance;
        moduleInstanceRef.current = instance;
        console.log('[INFO] [ModuleLoader] Module loaded successfully:', node.id);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load module';
          console.error('[ERROR] [ModuleLoader]', message);
          onError(message);
        }
      }
    }

    loadModule();

    // Cleanup function
    return () => {
      console.log('[DEBUG] [ModuleLoader] CLEANUP called for:', node.id);
      console.log('[DEBUG] [ModuleLoader] Cleanup - currentInstance:', !!currentInstance);
      console.log('[DEBUG] [ModuleLoader] Cleanup - containerElement.innerHTML length:', containerElement?.innerHTML?.length);

      cancelled = true;

      // Destroy module instance
      if (currentInstance?.destroy) {
        try {
          currentInstance.destroy();
          console.log('[INFO] [ModuleLoader] Module destroyed:', node.id);
        } catch (err) {
          console.error('[ERROR] [ModuleLoader] Error destroying module:', err);
        }
      }
      moduleInstanceRef.current = null;

      // Clear container
      if (containerElement) {
        console.log('[DEBUG] [ModuleLoader] Cleanup - clearing container innerHTML');
        containerElement.innerHTML = '';
      }
    };
  }, [node.id, node.file, onError]);

  // Handle theme changes
  useEffect(() => {
    if (moduleInstanceRef.current?.onThemeChange) {
      moduleInstanceRef.current.onThemeChange(theme);
    }
  }, [theme]);

  console.log('[DEBUG] [ModuleLoader] Returning JSX for container div');

  // Render the container div that modules will inject content into
  return <div ref={containerRef} className="module-container" />;
}

/**
 * Load a script and wait for the factory function to be available
 * Uses async/await pattern without setTimeout
 */
async function loadScript(src: string, factoryName: string): Promise<unknown> {
  console.log('[DEBUG] [loadScript] Starting to load:', src);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;

    script.onload = () => {
      console.log('[INFO] [ModuleLoader] Script loaded:', src);
      // Script has executed synchronously, factory should be available
      const factory = (window as unknown as Record<string, unknown>)[factoryName];
      console.log('[DEBUG] [loadScript] After load, factory type:', typeof factory);

      if (typeof factory === 'function') {
        resolve(factory);
      } else {
        console.log('[DEBUG] [loadScript] Factory not immediately available, waiting...');
        // Check if module uses __moduleReady callback pattern
        const originalReady = (window as unknown as Record<string, unknown>).__moduleReady;
        (window as unknown as Record<string, unknown>).__moduleReady = (name: string) => {
          console.log('[DEBUG] [loadScript] __moduleReady called with:', name);
          if (name === factoryName) {
            // Restore original
            (window as unknown as Record<string, unknown>).__moduleReady = originalReady;
            const f = (window as unknown as Record<string, unknown>)[factoryName];
            resolve(f);
          }
        };
        // Also resolve immediately if factory is available (race condition handling)
        const f = (window as unknown as Record<string, unknown>)[factoryName];
        if (typeof f === 'function') {
          (window as unknown as Record<string, unknown>).__moduleReady = originalReady;
          resolve(f);
        }
      }
    };

    script.onerror = () => {
      console.error('[ERROR] [loadScript] Failed to load:', src);
      reject(new Error(`Failed to load module script: ${src}`));
    };

    // Add script to document
    console.log('[DEBUG] [loadScript] Appending script to document.head');
    document.head.appendChild(script);
  });
}

/**
 * Convert module ID to factory function name
 * e.g., "calcA" -> "createCalcA"
 */
function getFactoryName(moduleId: string): string {
  const capitalizedId = moduleId.charAt(0).toUpperCase() + moduleId.slice(1);
  return `create${capitalizedId}`;
}

export default ModuleLoader;
