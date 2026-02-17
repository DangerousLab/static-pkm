/**
 * SES Sandbox for user modules
 * Provides isolated execution environment with restricted DOM access
 */

import type { ModuleInfo } from '@/types/content';

/** Maximum DOM nodes a module can create */
const MAX_DOM_NODES = 10000;

/** Blocked global properties */
const BLOCKED_GLOBALS = [
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'fetch',
  'XMLHttpRequest',
  'eval',
  'Function',
  'WebSocket',
  'Worker',
  'ServiceWorker',
  'importScripts',
  'open',
  'close',
  'alert',
  'confirm',
  'prompt',
];

/** Sandboxed module interface */
export interface SandboxedModule {
  execute: (code: string, factoryName: string) => ModuleInfo | null;
  getFactory: (name: string) => ((options: unknown) => unknown) | null;
  destroy: () => void;
}

/**
 * Create a sandboxed environment for user module execution
 * Uses SES Compartment for isolation
 */
export function createModuleSandbox(
  container: HTMLElement,
  moduleId: string
): SandboxedModule {
  console.log('[INFO] [sandbox] Creating sandbox for module:', moduleId);

  // Track created nodes for DoS protection
  let nodeCount = 0;

  // Storage for module exports
  const moduleExports: Record<string, unknown> = {};
  let moduleInfo: ModuleInfo | null = null;

  /**
   * Create sandboxed document proxy
   * Scopes all DOM operations to the container
   */
  const sandboxedDocument = createDocumentProxy(container, () => {
    nodeCount++;
    if (nodeCount > MAX_DOM_NODES) {
      throw new Error(`[SECURITY] Module exceeded max DOM node limit (${MAX_DOM_NODES})`);
    }
  });

  /**
   * Create sandboxed window proxy
   * Provides limited globals with blocked dangerous functions
   */
  const sandboxedWindow = createWindowProxy(moduleExports, (info: ModuleInfo) => {
    moduleInfo = info;
  });

  /**
   * Execute module code in SES compartment
   */
  function execute(code: string, factoryName: string): ModuleInfo | null {
    console.log('[INFO] [sandbox] Executing module with factory:', factoryName);

    try {
      // Check if SES lockdown is available
      if (typeof Compartment === 'undefined') {
        console.warn('[WARN] [sandbox] SES not available, using eval fallback');
        // Fallback: execute with limited scope (less secure)
        const wrappedCode = `
          (function(document, window, moduleInfo) {
            ${code}
          })
        `;
        const fn = new Function('document', 'window', 'moduleInfo', `
          ${code}
          return typeof window.moduleInfo !== 'undefined' ? window.moduleInfo : null;
        `);
        const result = fn(sandboxedDocument, sandboxedWindow, null);
        if (result) {
          moduleInfo = result as ModuleInfo;
        }
        return moduleInfo;
      }

      // Create SES compartment with restricted globals
      const compartment = new Compartment({
        document: sandboxedDocument,
        window: sandboxedWindow,
        console: createSandboxedConsole(moduleId),
        Math,
        JSON,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Promise,
        Error,
        TypeError,
        RangeError,
        SyntaxError,
        // Provide moduleInfo setter
        moduleInfo: {
          get: () => moduleInfo,
          set: (info: ModuleInfo) => {
            moduleInfo = info;
          },
        },
      });

      // Execute code in compartment
      compartment.evaluate(code);

      return moduleInfo;
    } catch (err) {
      console.error('[ERROR] [sandbox] Execution failed:', err);
      throw err;
    }
  }

  /**
   * Get factory function from module exports
   */
  function getFactory(name: string): ((options: unknown) => unknown) | null {
    // Check sandboxed window for factory
    const factory = (sandboxedWindow as Record<string, unknown>)[name];
    if (typeof factory === 'function') {
      return factory as (options: unknown) => unknown;
    }

    // Check module exports
    if (typeof moduleExports[name] === 'function') {
      return moduleExports[name] as (options: unknown) => unknown;
    }

    return null;
  }

  /**
   * Cleanup sandbox resources
   */
  function destroy(): void {
    console.log('[INFO] [sandbox] Destroying sandbox for module:', moduleId);
    nodeCount = 0;
  }

  return {
    execute,
    getFactory,
    destroy,
  };
}

/**
 * Create a proxy for document that scopes operations to a container
 */
function createDocumentProxy(
  container: HTMLElement,
  onNodeCreate: () => void
): Document {
  const handler: ProxyHandler<Document> = {
    get(target, prop) {
      // Scope queries to container
      switch (prop) {
        case 'getElementById':
          return (id: string) => container.querySelector(`#${id}`);

        case 'querySelector':
          return (selector: string) => container.querySelector(selector);

        case 'querySelectorAll':
          return (selector: string) => container.querySelectorAll(selector);

        case 'getElementsByClassName':
          return (className: string) => container.getElementsByClassName(className);

        case 'getElementsByTagName':
          return (tagName: string) => container.getElementsByTagName(tagName);

        case 'createElement':
          return (tagName: string) => {
            onNodeCreate();
            return document.createElement(tagName);
          };

        case 'createTextNode':
          return (text: string) => {
            onNodeCreate();
            return document.createTextNode(text);
          };

        case 'createDocumentFragment':
          return () => {
            onNodeCreate();
            return document.createDocumentFragment();
          };

        case 'body':
          return container;

        case 'head':
          return null; // Block access to head

        case 'documentElement':
          return container;

        default:
          const value = target[prop as keyof Document];
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
      }
    },
  };

  return new Proxy(document, handler);
}

/**
 * Create a proxy for window with restricted globals
 */
function createWindowProxy(
  exports: Record<string, unknown>,
  setModuleInfo: (info: ModuleInfo) => void
): Window {
  const allowedGlobals: Record<string, unknown> = {
    // Safe globals
    Math,
    JSON,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    console: createSandboxedConsole('module'),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  };

  const handler: ProxyHandler<Window> = {
    get(target, prop) {
      // Block dangerous globals
      if (BLOCKED_GLOBALS.includes(prop as string)) {
        console.warn(`[SECURITY] Blocked access to: ${String(prop)}`);
        return undefined;
      }

      // Return allowed globals
      if (prop in allowedGlobals) {
        return allowedGlobals[prop as string];
      }

      // Return exports
      if (prop in exports) {
        return exports[prop as string];
      }

      // Special case for moduleInfo
      if (prop === 'moduleInfo') {
        return {
          set: setModuleInfo,
        };
      }

      return undefined;
    },

    set(target, prop, value) {
      // Allow setting factory functions and moduleInfo
      if (typeof prop === 'string') {
        if (prop === 'moduleInfo') {
          setModuleInfo(value as ModuleInfo);
          return true;
        }
        exports[prop] = value;
        return true;
      }
      return false;
    },

    has(target, prop) {
      return prop in allowedGlobals || prop in exports;
    },
  };

  return new Proxy(window, handler);
}

/**
 * Create sandboxed console that prefixes output with module ID
 */
function createSandboxedConsole(moduleId: string): Console {
  const prefix = `[USER] [${moduleId}]`;

  return {
    ...console,
    log: (...args: unknown[]) => console.log(prefix, ...args),
    info: (...args: unknown[]) => console.info(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
    debug: (...args: unknown[]) => console.debug(prefix, ...args),
  };
}

// Declare Compartment type for SES
declare const Compartment: new (globals: Record<string, unknown>) => {
  evaluate: (code: string) => unknown;
};
