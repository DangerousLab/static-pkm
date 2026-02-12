/**
 * DOM Isolation Layer
 * Proxied document/window APIs for SES compartments
 */

export function createSandboxedDocument(instanceId, container) {
  // DOM node limits (prevents DoS attacks)
  const MAX_NODES = 10000;  // Maximum nodes per module
  const WARN_THRESHOLD = 0.8;  // Warn at 80% capacity
  let nodeCount = 0;
  let warningSent = false;
  
  // Proxied document that restricts access to module container
  return new Proxy({}, {
    get(target, prop) {
      // Allow safe methods scoped to module container
      if (prop === 'querySelector') {
        return container.querySelector.bind(container);
      }
      if (prop === 'querySelectorAll') {
        return container.querySelectorAll.bind(container);
      }
      if (prop === 'createElement') {
        // Return wrapped createElement with node counting
        return function(tagName) {
          // Check limit before creating
          if (nodeCount >= MAX_NODES) {
            const error = new Error(
              `[DOMIsolation] DOM node limit exceeded for ${instanceId}. ` +
              `Maximum ${MAX_NODES} nodes allowed. ` +
              `This prevents browser DoS attacks.`
            );
            console.error(error.message);
            throw error;
          }
          
          // Increment counter
          nodeCount++;
          
          // Warn at threshold
          if (!warningSent && nodeCount >= MAX_NODES * WARN_THRESHOLD) {
            warningSent = true;
            console.warn(
              `[DOMIsolation] ${instanceId} has created ${nodeCount} nodes ` +
              `(${Math.round((nodeCount / MAX_NODES) * 100)}% of limit). ` +
              `Consider optimizing DOM operations.`
            );
          }
          
          // Create element
          return document.createElement.call(document, tagName);
        };
      }
      if (prop === 'createTextNode') {
        // Text nodes also count toward limit
        return function(data) {
          if (nodeCount >= MAX_NODES) {
            const error = new Error(
              `[DOMIsolation] DOM node limit exceeded for ${instanceId}`
            );
            console.error(error.message);
            throw error;
          }
          
          nodeCount++;
          
          if (!warningSent && nodeCount >= MAX_NODES * WARN_THRESHOLD) {
            warningSent = true;
            console.warn(
              `[DOMIsolation] ${instanceId} approaching node limit: ${nodeCount}/${MAX_NODES}`
            );
          }
          
          return document.createTextNode.call(document, data);
        };
      }
      if (prop === 'createDocumentFragment') {
        // Fragments don't count (they're temporary containers)
        return document.createDocumentFragment.bind(document);
      }
      if (prop === 'createComment') {
        // Comments also count (though rarely abused)
        return function(data) {
          if (nodeCount >= MAX_NODES) {
            const error = new Error(
              `[DOMIsolation] DOM node limit exceeded for ${instanceId}`
            );
            console.error(error.message);
            throw error;
          }
          
          nodeCount++;
          return document.createComment.call(document, data);
        };
      }
      
      // Expose node count for debugging (read-only)
      if (prop === '__nodeCount') {
        return nodeCount;
      }
      if (prop === '__nodeLimit') {
        return MAX_NODES;
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
  
  // Track event listeners for cleanup (stored outside proxy to prevent module access)
  const eventListeners = new Map();
  
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
      
      // Allow event-related APIs (with restrictions)
      if (prop === 'CustomEvent') {
        // Return constructor, not bound function!
        return window.CustomEvent;
      }
      
      if (prop === 'Event') {
        return window.Event;
      }
      
      if (prop === 'addEventListener') {
        // Return scoped addEventListener
        return function(eventName, handler, options) {
          // Define safe global events (browser/UI events only)
          const safeGlobalEvents = ['resize', 'scroll', 'focus', 'blur'];
          
          // Check if event is instance-specific or safe global
          const isInstanceEvent = eventName.startsWith(instanceId);
          const isSafeGlobal = safeGlobalEvents.includes(eventName);
          
          if (!isInstanceEvent && !isSafeGlobal) {
            console.warn(
              `[DOMIsolation] Blocked addEventListener('${eventName}') from ${instanceId}. ` +
              `Use tunnel API for module communication or prefix with '${instanceId}:'`
            );
            return;
          }
          
          // Add listener to real window
          window.addEventListener(eventName, handler, options);
          
          // Track for cleanup on module destroy
          if (!eventListeners.has(eventName)) {
            eventListeners.set(eventName, []);
          }
          eventListeners.get(eventName).push({ handler, options });
          
          console.log(`[DOMIsolation] Allowed addEventListener('${eventName}') from ${instanceId}`);
        };
      }
      
      if (prop === 'removeEventListener') {
        // Return scoped removeEventListener
        return function(eventName, handler, options) {
          window.removeEventListener(eventName, handler, options);
          
          // Remove from tracking
          if (eventListeners.has(eventName)) {
            const listeners = eventListeners.get(eventName);
            const index = listeners.findIndex(l => l.handler === handler);
            if (index !== -1) {
              listeners.splice(index, 1);
            }
          }
          
          console.log(`[DOMIsolation] removeEventListener('${eventName}') from ${instanceId}`);
        };
      }
      
      if (prop === 'dispatchEvent') {
        // Return scoped dispatchEvent
        return function(event) {
          // Only allow dispatching instance-specific events
          const isInstanceEvent = event.type.startsWith(instanceId);
          
          if (!isInstanceEvent) {
            console.warn(
              `[DOMIsolation] Blocked dispatchEvent('${event.type}') from ${instanceId}. ` +
              `Event type must be prefixed with '${instanceId}:'`
            );
            return false;
          }
          
          console.log(`[DOMIsolation] Allowed dispatchEvent('${event.type}') from ${instanceId}`);
          return window.dispatchEvent(event);
        };
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
