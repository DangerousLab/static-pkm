(function () {
  function createCalcE(options) {
    const root = options.root;
    root.innerHTML = `
      <div class="calculator-header">
        <div class="calculator-title-row">
          <h1>Extremely Long Sidebar Calculator Title For Layout Testing</h1>
        </div>
        <p class="subtitle"><span>Eight-word title to force maximum hover expansion.</span></p>
      </div>
      <div class="panel">
        <div class="panel-title">Content</div>
        <p class="subtitle">This is a dummy calculator module (E).</p>
      </div>
    `;
    return {
      destroy() { root.innerHTML = ""; },
      onThemeChange() {}
    };
  }
  window.createCalcE = createCalcE;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcE');
  }
})();