// calcA.js v2.0 - Updated for shared CSS patterns
(function () {
  function createCalcA(options) {
    const container = options.container;

    console.log('[CalcA] Initializing');

    // ==================== NO INLINE STYLES NEEDED ====================
    // All styles now come from css/modules.css (shared classes)
    // No unique styles for this simple calculator

    const moduleContent = document.createElement('div');
    moduleContent.className = 'calca-root';

    // Using shared classes from css/modules.css
    moduleContent.innerHTML = `
      <div class="shared-module-header">
        <div class="shared-module-title-row">
          <h1>Short Test One</h1>
        </div>
        <p class="shared-module-subtitle"><span>Simple placeholder calculator for layout testing.</span></p>
      </div>
      <div class="shared-module-panel">
        <div class="shared-module-panel-title">Content</div>
        <p class="shared-module-subtitle">This is a dummy calculator module (A).</p>
      </div>
    `;

    container.appendChild(moduleContent);

    console.log('[CalcA] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcA] Destroying');
        container.innerHTML = "";
      },
      getState() {
        console.log('[CalcA] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcA] Setting state:', state);
      }
    };
  }

  window.createCalcA = createCalcA;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcA');
  }
})();
