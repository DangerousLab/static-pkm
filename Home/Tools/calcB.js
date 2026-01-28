(function () {
  function createCalcB(options) {
    const root = options.root;
    root.innerHTML = `
      <div class="calculator-header">
        <div class="calculator-title-row">
          <h1>Medium Length Name Test</h1>
        </div>
        <p class="subtitle"><span>Testing sidebar width with four-word title.</span></p>
      </div>
      <div class="panel">
        <div class="panel-title">Content</div>
        <p class="subtitle">This is a dummy calculator module (B).</p>
      </div>
    `;
    return {
      destroy() { root.innerHTML = ""; },
      onThemeChange() {}
    };
  }
  window.createCalcB = createCalcB;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcB');
  }
})();