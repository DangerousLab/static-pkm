import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { useThemeStore, type Theme } from '@core/state/themeStore';
import { createModuleSandbox, type SandboxedModule } from './sandbox';
import type { ModuleNode } from '@/types/navigation';
import type { ModuleInstance, ThemeController } from '@/types/content';

interface ModuleLoaderProps {
  node: ModuleNode;
  container: RefObject<HTMLDivElement>;
  onError: (error: string) => void;
}

/**
 * Module loader component
 * Handles loading, sandboxing, and rendering of user JavaScript modules
 */
function ModuleLoader({ node, container, onError }: ModuleLoaderProps): React.JSX.Element | null {
  const theme = useThemeStore((state) => state.theme);
  const moduleInstanceRef = useRef<ModuleInstance | null>(null);
  const sandboxRef = useRef<SandboxedModule | null>(null);

  // Create theme controller for modules
  const themeController: ThemeController = {
    getCurrentTheme: () => useThemeStore.getState().theme,
    subscribe: (callback: (theme: Theme) => void) => {
      return useThemeStore.subscribe((state) => callback(state.theme));
    },
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (moduleInstanceRef.current?.destroy) {
      try {
        moduleInstanceRef.current.destroy();
        console.log('[INFO] [ModuleLoader] Module destroyed:', node.id);
      } catch (err) {
        console.error('[ERROR] [ModuleLoader] Error destroying module:', err);
      }
    }
    moduleInstanceRef.current = null;
    sandboxRef.current = null;

    // Clear container
    if (container.current) {
      container.current.innerHTML = '';
    }
  }, [node.id, container]);

  // Load and render module
  useEffect(() => {
    let cancelled = false;

    async function loadModule(): Promise<void> {
      if (!container.current) return;

      // Cleanup previous module
      cleanup();

      try {
        console.log('[INFO] [ModuleLoader] Loading module:', node.id, 'from', node.file);

        // Fetch module code
        const response = await fetch(node.file);
        if (!response.ok) {
          throw new Error(`Failed to fetch module: ${response.statusText}`);
        }
        const code = await response.text();

        if (cancelled) return;

        // Create sandbox
        const sandbox = createModuleSandbox(container.current, node.id);
        sandboxRef.current = sandbox;

        // Execute module in sandbox
        const factoryName = getFactoryName(node.id);
        const moduleInfo = sandbox.execute(code, factoryName);

        if (cancelled) return;

        // Handle auto-render modules (CSS-only)
        if (moduleInfo?.type === 'auto') {
          console.log('[INFO] [ModuleLoader] Auto-render module:', node.id);
          if (moduleInfo.style) {
            const styleEl = document.createElement('style');
            styleEl.textContent = moduleInfo.style;
            container.current.appendChild(styleEl);
          }
          if (moduleInfo.content) {
            const contentEl = document.createElement('div');
            contentEl.innerHTML = moduleInfo.content;
            container.current.appendChild(contentEl);
          }
          return;
        }

        // Get factory function from sandbox
        const factory = sandbox.getFactory(factoryName);
        if (!factory) {
          throw new Error(`Module factory '${factoryName}' not found`);
        }

        // Create module instance
        const instance = factory({
          container: container.current,
          themeController,
        }) as ModuleInstance;

        if (cancelled) return;

        moduleInstanceRef.current = instance;

        // Render module
        if (instance.render) {
          instance.render(container.current, { container: container.current, themeController });
        }

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

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [node.id, node.file, container, cleanup, onError, themeController]);

  // Handle theme changes
  useEffect(() => {
    if (moduleInstanceRef.current?.onThemeChange) {
      moduleInstanceRef.current.onThemeChange(theme);
    }
  }, [theme]);

  // This component doesn't render anything directly
  // Content is injected into the container ref
  return null;
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
