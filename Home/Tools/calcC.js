(function () {
  function createCalcC(options) {
    const root = options.root;
    root.innerHTML = `
      <div class="calculator-header">
        <div class="calculator-title-row">
          <h1>Longer Sidebar Title Length Test</h1>
        </div>
        <p class="subtitle"><span>Five-word title for overflow behavior.</span></p>
      </div>
      <div class="panel">
        <div class="panel-title">Content</div>
        <p class="subtitle">This is a dummy calculator module (C).</p>
      </div>
    `;
    return {
      destroy() { root.innerHTML = ""; },
      onThemeChange() {}
    };
  }
  window.createCalcC = createCalcC;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcC');
  }
})();