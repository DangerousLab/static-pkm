// calcD.js v2.0 - Updated for shared CSS patterns
(function () {
  function createCalcD(options) {
    const container = options.container;

    console.log('[CalcD] Initializing');

    // ==================== NO INLINE STYLES NEEDED ====================
    // All styles now come from css/modules.css (shared classes)

    const moduleContent = document.createElement('div');
    moduleContent.className = 'calcd-root';

    // Using shared classes from css/modules.css
    moduleContent.innerHTML = `
      <div class="shared-module-header">
        <div class="shared-module-title-row">
          <h1>Really Quite Long Sidebar Title Example</h1>
        </div>
        <p class="shared-module-subtitle"><span>Six-word title, likely to overflow base width.</span></p>
      </div>
      <div class="shared-module-panel">
        <div class="shared-module-panel-title">Content</div>
        <p class="shared-module-subtitle">This is a dummy calculator module (D).</p>
      </div>
    `;

    container.appendChild(moduleContent);

    console.log('[CalcD] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcD] Destroying');
        container.innerHTML = "";
      },
      getState() {
        console.log('[CalcD] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcD] Setting state:', state);
      }
    };
  }

  window.createCalcD = createCalcD;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcD');
  }
})();
