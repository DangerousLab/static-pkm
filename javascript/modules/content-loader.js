/**
 * Content loading module
 * Handles loading of modules, pages, and documents
 */

import { dom, state, themeController } from '../core/state.js';
import { scriptUrlFromFile, factoryNameFromId, waitForFactory } from '../core/utils.js';
import { autoRender, dynamicRender } from '../loader/index.js';
import { instanceManager } from '../core/instance-manager.js';
import { createSandboxedDocument, createSandboxedWindow } from '../core/dom-isolation.js';
import { createSecureCompartment, buildCompartmentGlobals } from '../core/js-isolation.js';
import { messageTunnel } from '../core/message-tunnel.js';

/**
 * Detect module layer (Platform vs User)
 * @param {string} filePath - Module file path from tree.json
 * @returns {'PLATFORM'|'USER'}
 */
function getModuleLayer(filePath) {
  // Normalize path (remove leading ./ if present)
  const normalized = filePath.replace(/^\.\//, '');
  
  // User Layer: Home/ directory (user modules)
  if (normalized.startsWith('Home/')) {
    return 'USER';
  }
  
  // User Layer: javascript/user/ (user utilities)
  if (normalized.startsWith('javascript/user/')) {
    return 'USER';
  }
  
  // Platform Layer: Everything else
  // Note: Platform modules (javascript/modules/*) are statically imported in app.js
  // They should NEVER appear in tree.json or be loaded via content-loader
  return 'PLATFORM';
}

/**
 * Clear active module instance
 */
export function clearActiveInstance() {
  if (state.activeInstance && typeof state.activeInstance.destroy === "function") {
    try {
      const instanceId = state.activeNode 
        ? instanceManager.generateInstanceId(state.activeNode.id, null, 'card1')
        : null;
      
      if (instanceId) {
        instanceManager.destroy(instanceId);
      } else {
        state.activeInstance.destroy();
      }
    } catch (e) {
      console.error('[ContentLoader] Failed to destroy instance:', e);
    }
  }
  state.activeInstance = null;
}

/**
 * Fetch module code as text (for compartment evaluation)
 * Service worker will cache this automatically in PWA mode
 */
export async function fetchModuleCode(src) {
  console.log('[ContentLoader] Fetching module as text:', src);
  
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch module: ${response.status} ${response.statusText}`);
  }
  
  const code = await response.text();
  console.log('[ContentLoader] Fetched', code.length, 'bytes');
  
  return code;
}

/**
 * Get factory function for a module by evaluating in compartment
 * Returns { factory, moduleCode } to avoid re-fetching
 */
export async function getFactoryForModule(node, compartment) {
  const scriptSrc = scriptUrlFromFile(node.file);
  const factoryName = factoryNameFromId(node.id);

  // Fetch module code as text (service worker caches this in PWA!)
  const moduleCode = await fetchModuleCode(scriptSrc);
  
  // Evaluate code inside compartment (compiled with sandboxed globals)
  try {
    compartment.evaluate(moduleCode);
    console.log('[ContentLoader] Evaluated module code in compartment');
  } catch (error) {
    console.error('[ContentLoader] Failed to evaluate module code:', error);
    throw new Error(`Module evaluation failed for ${node.id}: ${error.message}`);
  }
  
  // Get factory from compartment's window (modules register on window.createModuleName)
  const factory = compartment.globalThis.window[factoryName];
  
  if (typeof factory !== "function") {
    console.error('[ContentLoader] Factory lookup failed. Available on window:', Object.keys(compartment.globalThis.window || {}));
    throw new Error(
      `Factory ${factoryName} not found or not a function in compartment for module ${node.id}`
    );
  }
  
  console.log('[ContentLoader] Factory extracted from compartment:', factoryName);
  
  return { factory, moduleCode };
}

/**
 * Load a module (interactive tool/calculator)
 * Note: Shared CSS patterns loaded via modules.css in index.html
 * Module-specific styles are inlined in each module's JS file
 */
export async function loadModule(node, done) {
  // Detect module layer for logging and future extensibility
  const moduleLayer = getModuleLayer(node.file);
  console.log('[ContentLoader] Loading module:', node.id, '| Layer:', moduleLayer, '| File:', node.file);
  
  // Validation: Only USER layer modules should be loaded via content-loader
  if (moduleLayer === 'PLATFORM') {
    console.error('[ContentLoader] ERROR: Platform modules should not be in navigation tree!');
    console.error('[ContentLoader] Platform modules must be statically imported in app.js');
    console.error('[ContentLoader] Attempted to load:', node.file);
    dom.card.innerHTML = "\n\nConfiguration Error: Platform module in navigation tree.";
    dom.card.classList.remove("preload");
    dom.card.classList.add("loaded");
    done(null);
    return;
  }
  
  // All modules loaded here are USER layer (apply isolation)
  console.log('[ContentLoader] Applying USER LAYER isolation (SES + Scoped CSS)');
  
  // Create instance ID first
  const instanceId = instanceManager.generateInstanceId(node.id, null, 'card1');
  
  // Create regular DOM container (no shadow root in v3.0)
  const container = document.createElement("div");
  container.className = "module-container";
  container.dataset.instanceId = instanceId;
  dom.card.appendChild(container);
  
  // Create sandboxed APIs (scoped to container)
  const sandboxedDocument = createSandboxedDocument(instanceId, container);
  const sandboxedWindow = createSandboxedWindow(instanceId);
  const tunnel = messageTunnel.createInstanceAPI(instanceId);
  
  // Create secure compartment with sandboxed globals (no factory/options yet!)
  const compartmentGlobals = buildCompartmentGlobals(
    instanceId,
    sandboxedDocument,
    sandboxedWindow,
    tunnel,
    themeController,
    dynamicRender,
  );
  
  const compartment = createSecureCompartment(instanceId, compartmentGlobals);
  instanceManager.registerCompartment(instanceId, compartment);

  // Fetch and evaluate module code in compartment
  getFactoryForModule(node, compartment)
    .then(({ factory }) => {
      // Create options object
      const options = {
        container: container,
        themeController: themeController,
        dynamicRender: dynamicRender,
        instanceId: instanceId,
        parentInstanceId: null,
        tunnel: tunnel
      };

      let instance = null;
      try {
        console.log('[ContentLoader] Creating module instance from compartment factory:', instanceId);
        
        // Add options to compartment globals
        compartment.globalThis.__options = options;
        
        // Call factory INSIDE compartment (correct context for DOM methods!)
        const factoryName = factoryNameFromId(node.id);
        instance = compartment.evaluate(`window.${factoryName}(__options)`) || {};
        
      } catch (err) {
        console.error('[ContentLoader] Module instantiation failed:', err);
        dom.card.innerHTML = "\n\nUnable to load module.";
        dom.card.classList.remove("preload");
        dom.card.classList.add("loaded");
        done(null);
        return;
      }

      requestAnimationFrame(async () => { 
        // v3.0: CSS isolation via scoped class prefixes
        // Modules use .modulename- prefix pattern
        
        await autoRender(container);
        dom.card.classList.remove("preload");
        dom.card.classList.add("loaded");
        
        console.log('[ContentLoader] Module loaded successfully in isolated environment:', instanceId);
      });

      instanceManager.register(instanceId, instance, {
        moduleId: node.id,
        parentId: null,
        cardId: 'card1',
        rootElement: container,
        container: container
      });

      done(instance);
    })
    .catch((err) => {
      console.error('[ContentLoader] Module loading failed:', err);
      dom.card.innerHTML = "\n\nUnable to load module.";
      dom.card.classList.remove("preload");
      dom.card.classList.add("loaded");
      done(null);
    });
}

/**
 * Load a page (static HTML content)
 */
export function loadPage(node, done) {
  const url = scriptUrlFromFile(node.file);
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load page: " + url);
      return res.text();
    })
    .then((html) => {
      dom.card.innerHTML = html;
      dom.card.classList.remove("preload");
      dom.card.classList.add("loaded");
      done({});
    })
    .catch((err) => {
      console.error(err);
      dom.card.innerHTML = "\n\nUnable to load page.";
      dom.card.classList.remove("preload");
      dom.card.classList.add("loaded");
      done(null);
    });
}

/**
 * Load a document (text/markdown content)
 */
export function loadDocument(node, done) {
  const url = scriptUrlFromFile(node.file);
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load document: " + url);
      return res.text();
    })
    .then((md) => {
      const inner = document.createElement("div");
      inner.className = "document-root";
      const pre = document.createElement("pre");
      pre.textContent = md;
      inner.appendChild(pre);
      dom.card.appendChild(inner);
      dom.card.classList.remove("preload");
      dom.card.classList.add("loaded");
      done({});
    })
    .catch((err) => {
      console.error(err);
      dom.card.innerHTML = "\n\nUnable to load document.";
      dom.card.classList.remove("preload");
      dom.card.classList.add("loaded");
      done(null);
    });
}

/**
 * Open a node (module/page/document)
 */
export function openNode(node) {
  if (!node) return;

  clearActiveInstance();

  dom.card.classList.remove("loaded");
  dom.card.classList.add("preload");
  dom.card.innerHTML = "";

  const type = node.type;

  if (type === "module") {
    loadModule(node, (instance) => {
      state.activeInstance = instance || {};
      state.activeNode = node;
    });
  } else if (type === "page") {
    loadPage(node, (instance) => {
      state.activeInstance = instance || {};
      state.activeNode = node;
    });
  } else if (type === "document") {
    loadDocument(node, (instance) => {
      state.activeInstance = instance || {};
      state.activeNode = node;
    });
  } else {
    dom.card.classList.remove("preload");
    dom.card.classList.add("loaded");
    state.activeInstance = {};
    state.activeNode = node;
  }
}