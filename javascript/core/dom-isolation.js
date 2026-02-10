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
        return (selector) => shadowRoot.querySelector(selector);
      }
      if (prop === 'querySelectorAll') {
        return (selector) => shadowRoot.querySelectorAll(selector);
      }
      if (prop === 'createElement') {
        // Return sandboxed element that can't be appended to real document
        const realCreateElement = document.createElement.bind(document);
        return (tag) => {
          const element = realCreateElement(tag);
          
          // Wrap element in proxy to block appendChild to document.head/body
          return new Proxy(element, {
            get(target, prop) {
              if (prop === 'appendChild' && (target.tagName === 'STYLE' || target.tagName === 'SCRIPT')) {
                return function(child) {
                  console.warn(`[DOMIsolation] Blocked ${target.tagName}.appendChild from ${instanceId}`);
                  return child;
                };
              }
              return Reflect.get(target, prop);
            }
          });
        };
      }
      if (prop === 'createTextNode') {
        return (text) => document.createTextNode(text);
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
  // Proxied window that restricts access
  return new Proxy({}, {
    get(target, prop) {
      // Allow safe globals
      const safeGlobals = ['Math', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Map', 'Set', 'Promise'];
      
      if (safeGlobals.includes(prop)) {
        return window[prop];
      }
      
      // Block dangerous operations
      if (prop === 'document' || prop === 'localStorage' || prop === 'sessionStorage') {
        console.warn(`[DOMIsolation] Blocked access to window.${prop} from ${instanceId}`);
        return undefined;
      }
      
      console.warn(`[DOMIsolation] Blocked window.${prop} from ${instanceId}`);
      return undefined;
    },
    
    set(target, prop, value) {
      console.warn(`[DOMIsolation] Blocked setting window.${prop} from ${instanceId}`);
      return false;
    }
  });
}
