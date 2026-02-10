// Home/Test/testIsolation.js
// Malicious module to test CSS isolation layers
// @tags: test, isolation, security

(function() {
  function createTestisolation(options) {
    const root = options.root;
    const instanceId = options.instanceId;
    
    console.log('=== ISOLATION TEST MODULE START ===');
    console.log('[TestIsolation] Instance ID:', instanceId);
    console.log('[TestIsolation] Root element:', root);
    
    // ATTACK 1: Global style in <head>
    console.log('[TestIsolation] ATTACK 1: Injecting global style into <head>');
    try {
      const globalStyle = document.createElement('style');
      globalStyle.textContent = `
        body { 
          background: red !important; 
          color: yellow !important;
        }
        .sidebar { display: none !important; }
        .app-header { background: purple !important; }
      `;
      document.head.appendChild(globalStyle);
      console.log('[TestIsolation] ✓ Global style injected (should affect whole app if isolation fails)');
    } catch (e) {
      console.log('[TestIsolation] ✗ Global style injection blocked:', e.message);
    }
    
    // ATTACK 2: Style inside module (should be scoped)
    console.log('[TestIsolation] ATTACK 2: Adding <style> tag inside module');
    root.innerHTML = `
      <style>
        /* These should be scoped to this module only */
        body { font-size: 50px !important; }
        h1 { color: red !important; font-size: 100px !important; }
        .nav-item { background: orange !important; color: black !important; }
        * { border: 5px solid lime !important; }
      </style>
      
      <div style="padding: 20px;">
        <h1>🔒 Isolation Test Module</h1>
        
        <div style="background: rgba(255,0,0,0.1); padding: 15px; margin: 15px 0; border-radius: 8px;">
          <h3>Attack Results (check console):</h3>
          <ol style="line-height: 1.8;">
            <li><strong>Global &lt;style&gt; in &lt;head&gt;:</strong> Check if sidebar/header affected</li>
            <li><strong>Module &lt;style&gt; tag:</strong> This text should be red, but nav items should NOT be orange</li>
            <li><strong>Direct card manipulation:</strong> Check console for errors</li>
            <li><strong>Parent access:</strong> Check console for block attempts</li>
            <li><strong>Global scope pollution:</strong> Check window object</li>
          </ol>
        </div>
        
        <div style="background: rgba(0,255,0,0.1); padding: 15px; margin: 15px 0; border-radius: 8px;">
          <h3>✅ Expected Behavior (if isolation works):</h3>
          <ul style="line-height: 1.8;">
            <li>Sidebar/header should look NORMAL (not purple/hidden)</li>
            <li>Body background should be NORMAL (not red)</li>
            <li>Only THIS card's h1 should be red</li>
            <li>Nav items should be NORMAL (not orange)</li>
            <li>Console shows blocked/scoped attempts</li>
          </ul>
        </div>
        
        <div style="background: rgba(0,0,255,0.1); padding: 15px; margin: 15px 0; border-radius: 8px;">
          <h3>🔍 Inspect Element:</h3>
          <p>Check this module's &lt;style&gt; tag in DevTools. Selectors should be prefixed with:</p>
          <code style="background: #333; color: #0f0; padding: 5px; display: block; margin-top: 10px;">
            .module-boundary[data-instance-id="${instanceId}"]
          </code>
        </div>
      </div>
    `;
    
    console.log('[TestIsolation] ✓ Module content with <style> tag rendered');
    
    // ATTACK 3: Direct card manipulation
    console.log('[TestIsolation] ATTACK 3: Attempting to manipulate card directly');
    try {
      const card = root.parentElement;
      console.log('[TestIsolation] Found card:', card.className);
      
      card.style.position = 'fixed';
      card.style.zIndex = '99999';
      card.style.transform = 'rotate(45deg) scale(2)';
      card.style.border = '20px solid red';
      
      console.log('[TestIsolation] ✓ Card manipulation succeeded (BAD - isolation weak)');
    } catch (e) {
      console.log('[TestIsolation] ✗ Card manipulation blocked:', e.message);
    }
    
    // ATTACK 4: Access parent elements
    console.log('[TestIsolation] ATTACK 4: Attempting to access parent elements');
    try {
      const body = document.body;
      body.style.background = 'linear-gradient(45deg, red, blue)';
      console.log('[TestIsolation] ✓ Body manipulation succeeded (BAD - isolation weak)');
    } catch (e) {
      console.log('[TestIsolation] ✗ Body manipulation blocked:', e.message);
    }
    
    // ATTACK 5: Global scope pollution
    console.log('[TestIsolation] ATTACK 5: Polluting global scope');
    try {
      window.MALICIOUS_GLOBAL = 'I broke the isolation!';
      console.log('[TestIsolation] ✓ Global scope pollution succeeded (expected - JS isolation not implemented)');
    } catch (e) {
      console.log('[TestIsolation] ✗ Global scope pollution blocked:', e.message);
    }
    
    // ATTACK 6: Query selector outside module
    console.log('[TestIsolation] ATTACK 6: Querying elements outside module');
    try {
      const sidebar = document.querySelector('.sidebar');
      const header = document.querySelector('.app-header');
      console.log('[TestIsolation] Found sidebar:', !!sidebar);
      console.log('[TestIsolation] Found header:', !!header);
      
      if (sidebar) {
        sidebar.style.display = 'none';
        console.log('[TestIsolation] ✓ Sidebar hidden (BAD - DOM access not restricted)');
      }
    } catch (e) {
      console.log('[TestIsolation] ✗ DOM query blocked:', e.message);
    }
    
    console.log('=== ISOLATION TEST MODULE END ===');
    console.log('📊 CSS Isolation: Check if styles scoped to module only');
    console.log('📊 DOM Isolation: NOT IMPLEMENTED (modules can access parent DOM)');
    console.log('📊 JS Isolation: NOT IMPLEMENTED (modules run in global scope)');
    
    return {
      getState() {
        console.log('[TestIsolation] getState called');
        return { testMode: true };
      },
      
      setState(state) {
        console.log('[TestIsolation] setState called:', state);
      },
      
      destroy() {
        console.log('[TestIsolation] destroy called - cleaning up');
        
        try {
          delete window.MALICIOUS_GLOBAL;
          console.log('[TestIsolation] Cleaned up global pollution');
        } catch (e) {
          console.log('[TestIsolation] Failed to clean up:', e.message);
        }
        
        root.innerHTML = '';
      }
    };
  }
  
  window.createTestisolation = createTestisolation;
  if (window.__moduleReady) {
    window.__moduleReady('createTestisolation');
  }
})();
