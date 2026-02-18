// calcC.js v2.0 - Updated for shared CSS patterns
(function () {
  function createCalcC(options) {
    const container = options.container;

    console.log('[CalcC] Initializing');

    // ==================== NO INLINE STYLES NEEDED ====================
    // All styles now come from css/modules.css (shared classes)

    const moduleContent = document.createElement('div');
    moduleContent.className = 'calcc-root';

    // Using shared classes from css/modules.css
    moduleContent.innerHTML = `
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

    container.appendChild(moduleContent);

    console.log('[CalcC] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcC] Destroying');
        container.innerHTML = "";
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
