/**
 * JavaScript Isolation Layer
 * SES Compartment wrapper for secure module execution
 */

export function createSecureCompartment(instanceId, globalOverrides = {}) {
  const compartment = new Compartment(globalOverrides);
  
  console.log(`[JSIsolation] Created secure compartment for ${instanceId}`);
  
  return compartment;
}

export function evaluateModuleFactory(compartment, factoryName) {
  // Module already loaded in global scope, get reference
  try {
    // Evaluate code that returns the factory from window
    const factory = compartment.evaluate(`
      (function() {
        if (typeof window !== 'undefined' && typeof window.${factoryName} === 'function') {
          return window.${factoryName};
        }
        throw new Error('Factory ${factoryName} not found');
      })()
    `);
    
    return factory;
  } catch (error) {
    console.error(`[JSIsolation] Failed to evaluate factory ${factoryName}:`, error);
    throw error;
  }
}

export function buildCompartmentGlobals(instanceId, sandboxedDocument, sandboxedWindow, tunnel, themeController, dynamicRender) {
  return {
    // Sandboxed globals
    document: sandboxedDocument,
    window: sandboxedWindow,
    
    // Safe globals (hardened by lockdown())
    console: console,
    Math: Math,
    JSON: JSON,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    RegExp: RegExp,
    Map: Map,
    Set: Set,
    Promise: Promise,
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    SyntaxError: SyntaxError,
    
    // Event constructors (needed for modules that dispatch events)
    CustomEvent: CustomEvent,
    Event: Event,
    
    // Utility functions
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    
    // Animation frame (for rendering, NOT logic timing - allowed by project rules)
    requestAnimationFrame: requestAnimationFrame.bind(window),
    cancelAnimationFrame: cancelAnimationFrame.bind(window),
    
    // Utilities provided by app (HARDENED to prevent prototype pollution)
    tunnel: harden(tunnel),
    themeController: harden(themeController),
    dynamicRender: harden(dynamicRender),
    
    // Block dangerous globals
    eval: undefined,
    Function: undefined,
    setTimeout: undefined,  // Enforce no setTimeout (your rule)
    setInterval: undefined,  // Enforce no setInterval (your rule)
    
    // Block network access (prevents data exfiltration)
    fetch: undefined,
    XMLHttpRequest: undefined,
    
    // Block DOM observers (prevents parent DOM spying)
    MutationObserver: undefined,
    IntersectionObserver: undefined,
    ResizeObserver: undefined
  };
}
