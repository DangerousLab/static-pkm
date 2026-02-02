// calcB.js v2.0 - Updated for shared CSS patterns
(function () {
  function createCalcB(options) {
    const root = options.root;

    console.log('[CalcB] Initializing');

    // ==================== NO INLINE STYLES NEEDED ====================
    // All styles now come from css/modules.css (shared classes)

    const container = document.createElement('div');
    container.className = 'calcb-root';

    // Using shared classes from css/modules.css
    container.innerHTML = `
      <div class="shared-module-header">
        <div class="shared-module-title-row">
          <h1>Medium Length Name Test</h1>
        </div>
        <p class="shared-module-subtitle"><span>Testing sidebar width with four-word title.</span></p>
      </div>
      <div class="shared-module-panel">
        <div class="shared-module-panel-title">Content</div>
        <p class="shared-module-subtitle">This is a dummy calculator module (B).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcB] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcB] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcB] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcB] Setting state:', state);
      }
    };
  }

  window.createCalcB = createCalcB;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcB');
  }
})();
