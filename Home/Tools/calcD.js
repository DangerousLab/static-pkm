// calcD.js v2.0 - Updated for shared CSS patterns
(function () {
  function createCalcD(options) {
    const root = options.root;

    console.log('[CalcD] Initializing');

    // ==================== NO INLINE STYLES NEEDED ====================
    // All styles now come from css/modules.css (shared classes)

    const container = document.createElement('div');
    container.className = 'calcd-root';

    // Using shared classes from css/modules.css
    container.innerHTML = `
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

    root.appendChild(container);

    console.log('[CalcD] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcD] Destroying');
        root.innerHTML = "";
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
