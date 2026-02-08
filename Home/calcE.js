// calcE.js v2.0 - Updated for shared CSS patterns
(function () {
  function createCalcE(options) {
    const root = options.root;

    console.log('[CalcE] Initializing');

    // ==================== NO INLINE STYLES NEEDED ====================
    // All styles now come from css/modules.css (shared classes)

    const container = document.createElement('div');
    container.className = 'calce-root';

    // Using shared classes from css/modules.css
    container.innerHTML = `
      <div class="shared-module-header">
        <div class="shared-module-title-row">
          <h1>Extremely Long Sidebar Calculator Title For Layout Testing</h1>
        </div>
        <p class="shared-module-subtitle"><span>Eight-word title to force maximum hover expansion.</span></p>
      </div>
      <div class="shared-module-panel">
        <div class="shared-module-panel-title">Content</div>
        <p class="shared-module-subtitle">This is a dummy calculator module (E).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcE] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcE] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcE] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcE] Setting state:', state);
      }
    };
  }

  window.createCalcE = createCalcE;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcE');
  }
})();
