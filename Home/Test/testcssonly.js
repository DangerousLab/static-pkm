(function() {
  function createTestcssonly(options) {
    const root = options.root;
    const instanceId = options.instanceId;
    
    console.log('[TestCssOnly] Instance ID:', instanceId);
    
    // Only test INTERNAL styles (no attacks)
    root.innerHTML = `
      <style>
        h1 { color: red; font-size: 50px; }
        p { background: yellow; padding: 20px; }
        .special { border: 10px solid lime; }
      </style>
      
      <div style="padding: 20px;">
        <h1>CSS Isolation Test (Benign)</h1>
        <p class="special">
          If CSS isolation works:
          - This heading is RED and HUGE
          - This paragraph has YELLOW background
          - This box has LIME border
          - BUT navigation items in sidebar are NORMAL (not red)
        </p>
      </div>
    `;
    
    return {
      getState() { return {}; },
      setState() {},
      destroy() { root.innerHTML = ''; }
    };
  }
  
  window.createTestcssonly = createTestcssonly;
  if (window.__moduleReady) {
    window.__moduleReady('createTestcssonly');
  }
})();
