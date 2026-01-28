(function () {
  function createCalcD(options) {
    const root = options.root;
    root.innerHTML = `
      <div class="calculator-header">
        <div class="calculator-title-row">
          <h1>Really Quite Long Sidebar Title Example</h1>
        </div>
        <p class="subtitle"><span>Six-word title, likely to overflow base width.</span></p>
      </div>
      <div class="panel">
        <div class="panel-title">Content</div>
        <p class="subtitle">This is a dummy calculator module (D).</p>
      </div>
    `;
    return {
      destroy() { root.innerHTML = ""; },
      onThemeChange() {}
    };
  }
  window.createCalcD = createCalcD;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcD');
  }
})();