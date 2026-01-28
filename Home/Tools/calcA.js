(function () {
  function createCalcA(options) {
    const root = options.root;
    root.innerHTML = `
      <div class="calculator-header">
        <div class="calculator-title-row">
          <h1>Short Test One</h1>
        </div>
        <p class="subtitle"><span>Simple placeholder calculator for layout testing.</span></p>
      </div>
      <div class="panel">
        <div class="panel-title">Content</div>
        <p class="subtitle">This is a dummy calculator module (A).</p>
      </div>
    `;
    return {
      destroy() { root.innerHTML = ""; },
      onThemeChange() {}
    };
  }
  window.createCalcA = createCalcA;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcA');
  }
})();