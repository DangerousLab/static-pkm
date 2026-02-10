/**
 * Content loading module
 * Handles loading of modules, pages, and documents
 */

import { dom, state, themeController } from '../core/state.js';
import { scriptUrlFromFile, factoryNameFromId, waitForFactory } from '../core/utils.js';
import { autoRender, dynamicRender } from '../loader/index.js';
import { instanceManager } from '../core/instance-manager.js';
import { createShadowRoot, createSandboxedDocument, createSandboxedWindow } from '../core/dom-isolation.js';
import { createSecureCompartment, buildCompartmentGlobals } from '../core/js-isolation.js';
import { messageTunnel } from '../core/message-tunnel.js';

/**
 * Typeset math expressions using MathJax
 */
export function typesetMath(rootEl) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([rootEl]).catch(function (err) {
      console.error("MathJax typeset failed", err);
    });
  }
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
 * Load a script file once (with caching)
 */
export function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (state.loadedScripts.has(src)) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[data-module-src="' + src + '"]'
    );
    if (existing) {
      state.loadedScripts.add(src);
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.moduleSrc = src;

    script.onload = () => {
      state.loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => {
      console.error("Failed to load script:", src);
      reject(new Error("Failed to load script: " + src));
    };

    document.head.appendChild(script);
  });
}

/**
 * Get factory function for a module
 */
export function getFactoryForModule(node) {
  if (state.moduleFactories.has(node.id)) {
    return Promise.resolve(state.moduleFactories.get(node.id));
  }

  const scriptSrc = scriptUrlFromFile(node.file);
  const factoryName = factoryNameFromId(node.id);

  return loadScriptOnce(scriptSrc).then(() => {
    return waitForFactory(factoryName).then((factory) => {
      if (typeof factory !== "function") {
        throw new Error(
          "Factory " + factoryName + " is not a function for module " + node.id
        );
      }
      state.moduleFactories.set(node.id, factory);
      return factory;
    });
  });
}

/**
 * Load a module (interactive tool/calculator)
 * Note: Shared CSS patterns loaded via modules.css in index.html
 * Module-specific styles are inlined in each module's JS file
 */
export function loadModule(node, done) {
  console.log('[ContentLoader] Loading module:', node.id);
  
  getFactoryForModule(node)
    .then((factory) => {
      const instanceId = instanceManager.generateInstanceId(node.id, null, 'card1');
      
      // Create shadow root container
      const container = document.createElement("div");
      container.className = "module-container";
      container.dataset.instanceId = instanceId;
      dom.card.appendChild(container);
      
      // Create isolated shadow DOM
      const { shadowRoot, contentRoot } = createShadowRoot(container, instanceId);
      
      // Create sandboxed APIs
      const sandboxedDocument = createSandboxedDocument(instanceId, shadowRoot);
      const sandboxedWindow = createSandboxedWindow(instanceId);
      const tunnel = messageTunnel.createInstanceAPI(instanceId);
      
      // Create options object
      const options = {
        root: contentRoot,
        themeController: themeController,
        dynamicRender: dynamicRender,
        instanceId: instanceId,
        parentInstanceId: null,
        tunnel: tunnel
      };
      
      // Create secure compartment with sandboxed globals (including factory and options)
      const compartmentGlobals = buildCompartmentGlobals(
        instanceId,
        sandboxedDocument,
        sandboxedWindow,
        tunnel,
        themeController,
        dynamicRender,
        factory,   // ← Pass factory
        options    // ← Pass options
      );
      
      const compartment = createSecureCompartment(instanceId, compartmentGlobals);
      instanceManager.registerCompartment(instanceId, compartment);

      let instance = null;
      try {
        console.log('[ContentLoader] Creating module instance in secure compartment:', instanceId);
        
        // Execute factory INSIDE compartment (__moduleFactory and __options available as globals)
        const factoryCode = `
          (function() {
            if (typeof __moduleFactory !== 'function') {
              throw new Error('Module factory not available in compartment');
            }
            return __moduleFactory(__options);
          })()
        `;
        
        // Evaluate inside compartment (no endowments needed, everything in globals)
        instance = compartment.evaluate(factoryCode) || {};
        
      } catch (err) {
        console.error('[ContentLoader] Module instantiation failed:', err);
        dom.card.innerHTML = "\n\nUnable to load module.";
        dom.card.classList.remove("preload");
        dom.card.classList.add("loaded");
        done(null);
        return;
      }

      requestAnimationFrame(async () => { 
        // Shadow DOM handles CSS isolation automatically
        // No need for scopeModuleStyles()
        
        await autoRender(contentRoot);
        dom.card.classList.remove("preload");
        dom.card.classList.add("loaded");
        
        console.log('[ContentLoader] Module loaded successfully in isolated environment:', instanceId);
      });

      instanceManager.register(instanceId, instance, {
        moduleId: node.id,
        parentId: null,
        cardId: 'card1',
        rootElement: contentRoot,
        shadowRoot: shadowRoot,
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