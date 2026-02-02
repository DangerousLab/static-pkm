/**
 * Content loading module
 * Handles loading of modules, pages, and documents
 */

import { dom, state, themeController } from '../core/state.js';
import { scriptUrlFromFile, factoryNameFromId, waitForFactory } from '../core/utils.js';

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
      state.activeInstance.destroy();
    } catch (e) {
      // ignore destroy errors
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
      const innerRoot = document.createElement("div");
      innerRoot.className = "content-root";
      dom.card.appendChild(innerRoot);

      let instance = null;
      try {
        console.log('[ContentLoader] Creating module instance:', node.id);
        instance = factory({ root: innerRoot, themeController }) || {};
      } catch (err) {
        console.error('[ContentLoader] Module instantiation failed:', err);
        dom.card.innerHTML = "\n\nUnable to load module.";
        dom.card.classList.remove("preload");
        dom.card.classList.add("loaded");
        done(null);
        return;
      }

      requestAnimationFrame(() => {
        // Removed: Redundant sidebar label update
        // Tree generator already extracted <h1> at build time
        // Sidebar label should remain stable from tree.json
        
        typesetMath(innerRoot);
        dom.card.classList.remove("preload");
        dom.card.classList.add("loaded");
        
        console.log('[ContentLoader] Module loaded successfully:', node.id);
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