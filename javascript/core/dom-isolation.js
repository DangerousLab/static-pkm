/**
 * DOM Isolation Layer
 * Shadow DOM setup + Proxied document/window APIs
 */

export function createShadowRoot(container, instanceId) {
  // Create closed shadow root (maximum isolation)
  const shadowRoot = container.attachShadow({ mode: 'closed' });
  
  // Inject theme CSS into shadow root
  injectThemeStyles(shadowRoot);
  
  // Create module content container
  const contentRoot = document.createElement('div');
  contentRoot.className = 'module-content';
  contentRoot.dataset.instanceId = instanceId;
  shadowRoot.appendChild(contentRoot);
  
  return { shadowRoot, contentRoot };
}

export function injectThemeStyles(shadowRoot) {
  // Create <style> tag with theme CSS variables
  const themeStyle = document.createElement('style');
  themeStyle.textContent = `
    :host {
      /* Import theme variables from parent */
      display: block;
      width: 100%;
      height: 100%;
    }
    
    .module-content {
      /* Theme variables accessible here */
      color: var(--text-primary);
      background: var(--bg-primary);
      /* ... all theme variables */
    }
  `;
  shadowRoot.appendChild(themeStyle);
}

export function createSandboxedDocument(instanceId, shadowRoot) {
  // Proxied document that restricts access
  return new Proxy({}, {
    get(target, prop) {
      // Allow safe methods scoped to shadow root
      if (prop === 'querySelector') {
        return shadowRoot.querySelector.bind(shadowRoot);
      }
      if (prop === 'querySelectorAll') {
        return shadowRoot.querySelectorAll.bind(shadowRoot);
      }
      if (prop === 'createElement') {
        // Return properly bound createElement
        return document.createElement.bind(document);
      }
      if (prop === 'createTextNode') {
        return document.createTextNode.bind(document);
      }
      if (prop === 'createDocumentFragment') {
        return document.createDocumentFragment.bind(document);
      }
      if (prop === 'createComment') {
        return document.createComment.bind(document);
      }
      
      // Block dangerous operations
      if (prop === 'body' || prop === 'head' || prop === 'documentElement') {
        console.warn(`[DOMIsolation] Blocked access to document.${prop} from ${instanceId}`);
        return null;
      }
      
      console.warn(`[DOMIsolation] Blocked document.${prop} from ${instanceId}`);
      return undefined;
    }
  });
}

export function createSandboxedWindow(instanceId) {
  // Storage for module-specific properties (factory, moduleInfo, etc.)
  const moduleStorage = {};
  
  // Proxied window that restricts access
  return new Proxy(moduleStorage, {
    get(target, prop) {
      // Allow safe globals (constructors and objects)
      const safeGlobals = [
        'Math', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 
        'Date', 'RegExp', 'Map', 'Set', 'Promise', 'Error', 'TypeError',
        'RangeError', 'SyntaxError', 'parseInt', 'parseFloat', 'isNaN',
        'isFinite', 'decodeURI', 'decodeURIComponent', 'encodeURI',
        'encodeURIComponent'
      ];
      
      if (safeGlobals.includes(prop)) {
        return window[prop];
      }
      
      // Allow reading module-registered properties (factory functions, moduleInfo)
      if (prop in target) {
        return target[prop];
      }
      
      // Block dangerous operations
      if (prop === 'document' || prop === 'localStorage' || prop === 'sessionStorage') {
        console.warn(`[DOMIsolation] Blocked access to window.${prop} from ${instanceId}`);
        return undefined;
      }
      
      // Allow event-related APIs
      if (prop === 'CustomEvent') {
        // Return constructor, not bound function!
        return window.CustomEvent;
      }
      if (prop === 'dispatchEvent') {
        return window.dispatchEvent.bind(window);
      }
      if (prop === 'addEventListener') {
        return window.addEventListener.bind(window);
      }
      if (prop === 'removeEventListener') {
        return window.removeEventListener.bind(window);
      }
      if (prop === 'Event') {
        return window.Event;
      }
      
      // Allow __moduleReady callback pattern (legacy modules)
      if (prop === '__moduleReady' && typeof window.__moduleReady === 'function') {
        return window.__moduleReady;
      }
      
      console.warn(`[DOMIsolation] Blocked window.${prop} from ${instanceId}`);
      return undefined;
    },
    
    set(target, prop, value) {
      // Allow setting factory functions (createModuleName pattern)
      if (prop.startsWith('create') && typeof value === 'function') {
        console.log(`[DOMIsolation] Allowed factory registration: window.${prop} from ${instanceId}`);
        target[prop] = value;
        return true;
      }
      
      // Allow setting moduleInfo
      if (prop === 'moduleInfo' && typeof value === 'object') {
        console.log(`[DOMIsolation] Allowed moduleInfo registration from ${instanceId}`);
        target[prop] = value;
        return true;
      }
      
      // Block everything else
      console.warn(`[DOMIsolation] Blocked setting window.${prop} from ${instanceId}`);
      return false;
    }
  });
}
