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

export function buildCompartmentGlobals(instanceId, sandboxedDocument, sandboxedWindow, tunnel, themeController, dynamicRender, moduleFactory, options) {
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
    
    // Utilities provided by app
    tunnel: tunnel,
    themeController: themeController,
    dynamicRender: dynamicRender,
    
    // Module factory and options (passed from outer realm)
    __moduleFactory: moduleFactory,
    __options: options,
    
    // Block dangerous globals
    eval: undefined,
    Function: undefined,
    setTimeout: undefined,  // Enforce no setTimeout (your rule)
    setInterval: undefined  // Enforce no setInterval (your rule)
  };
}
