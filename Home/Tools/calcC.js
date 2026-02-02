// calcC.js v2.0 - Updated for shared CSS patterns
(function () {
  function createCalcC(options) {
    const root = options.root;

    console.log('[CalcC] Initializing');

    // ==================== NO INLINE STYLES NEEDED ====================
    // All styles now come from css/modules.css (shared classes)

    const container = document.createElement('div');
    container.className = 'calcc-root';

    // Using shared classes from css/modules.css
    container.innerHTML = `
      <div class="shared-module-header">
        <div class="shared-module-title-row">
          <h1>Longer Sidebar Title Length Test</h1>
        </div>
        <p class="shared-module-subtitle"><span>Five-word title for overflow behavior.</span></p>
      </div>
      <div class="shared-module-panel">
        <div class="shared-module-panel-title">Content</div>
        <p class="shared-module-subtitle">This is a dummy calculator module (C).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcC] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcC] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcC] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcC] Setting state:', state);
      }
    };
  }

  window.createCalcC = createCalcC;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcC');
  }
})();
