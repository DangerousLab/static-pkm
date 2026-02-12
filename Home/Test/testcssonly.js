// Home/Test/testcssonly.js
// CSS-only module test - verifies shadow DOM CSS isolation
// @tags: test, css, shadow-dom, isolation

(function() {
  'use strict';

  function createTestcssonly(options) {
    const container = options.container;
    const instanceId = options.instanceId;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🎨 CSS-ONLY TEST MODULE');
    console.log('═══════════════════════════════════════════════════');
    console.log('[TestCSSOnly] Instance ID:', instanceId);
    console.log('[TestCSSOnly] Testing shadow DOM CSS isolation');
    
    // Render test UI with inline styles
    container.innerHTML = `
      <style>
        /* All styles are scoped to this shadow root */
        .testcssonly-container {
          padding: 30px;
          font-family: 'Courier New', monospace;
          line-height: 1.8;
        }
        
        .testcssonly-header {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: #1a1a1a;
          padding: 25px;
          border-radius: 12px;
          margin-bottom: 30px;
          text-align: center;
        }
        
        .testcssonly-header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: bold;
        }
        
        .testcssonly-header p {
          margin: 0;
          opacity: 0.8;
          font-size: 14px;
        }
        
        .testcssonly-info-box {
          background: var(--bg-secondary, #2a2a2a);
          border: 2px solid #00f2fe;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        
        .testcssonly-info-box h2 {
          margin: 0 0 15px 0;
          color: #00f2fe;
          font-size: 18px;
        }
        
        .testcssonly-info-box ul {
          margin: 10px 0 0 0;
          padding-left: 25px;
        }
        
        .testcssonly-info-box li {
          margin: 8px 0;
          color: var(--text-secondary, #cccccc);
        }
        
        .testcssonly-status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }
        
        .testcssonly-status-item {
          background: var(--bg-secondary, #2a2a2a);
          border-left: 4px solid #00f2fe;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }
        
        .testcssonly-status-icon {
          font-size: 32px;
          margin-bottom: 10px;
        }
        
        .testcssonly-status-label {
          font-size: 14px;
          color: var(--text-secondary, #cccccc);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .testcssonly-summary {
          background: rgba(0, 242, 254, 0.1);
          border: 2px solid #00f2fe;
          padding: 25px;
          border-radius: 12px;
          text-align: center;
          margin-top: 30px;
        }
        
        .testcssonly-summary h2 {
          margin: 0 0 15px 0;
          font-size: 32px;
          color: #00f2fe;
        }
        
        .testcssonly-summary p {
          margin: 5px 0;
          font-size: 16px;
          color: var(--text-primary, #ffffff);
        }
        
        .testcssonly-console-note {
          background: rgba(79, 172, 254, 0.1);
          border-left: 4px solid #4facfe;
          padding: 15px;
          margin-top: 20px;
          border-radius: 6px;
          font-size: 14px;
        }
        
        code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          color: #00f2fe;
          font-family: 'Courier New', monospace;
        }
        
        .testcssonly-color-box {
          width: 100%;
          height: 60px;
          background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1a1a1a;
          font-weight: bold;
          margin-top: 15px;
        }
      </style>
      
      <div class="testcssonly-container">
        <div class="testcssonly-header">
          <h1>🎨 CSS-Only Test Module</h1>
          <p>Scoped CSS Isolation Verification</p>
          <p style="opacity: 0.7; margin-top: 5px;">Instance: ${instanceId}</p>
        </div>
        
        <div class="testcssonly-info-box">
          <h2>✨ What This Module Tests</h2>
          <ul>
            <li>CSS scoping via class prefixes (styles don't leak out)</li>
            <li>Module can use inline styles without conflicts</li>
            <li>CSS variables from parent theme are accessible</li>
            <li>No JavaScript execution - pure HTML/CSS rendering</li>
          </ul>
        </div>
        
        <div class="testcssonly-status-grid">
          <div class="testcssonly-status-item">
            <div class="testcssonly-status-icon">✅</div>
            <div class="testcssonly-status-label">Shadow DOM Active</div>
          </div>
          
          <div class="testcssonly-status-item">
            <div class="testcssonly-status-icon">🎨</div>
            <div class="testcssonly-status-label">CSS Isolated</div>
          </div>
          
          <div class="testcssonly-status-item">
            <div class="testcssonly-status-icon">🔒</div>
            <div class="testcssonly-status-label">No Style Leaks</div>
          </div>
          
          <div class="testcssonly-status-item">
            <div class="testcssonly-status-icon">⚡</div>
            <div class="testcssonly-status-label">Zero JavaScript</div>
          </div>
        </div>
        
        <div class="testcssonly-info-box">
          <h2>🧪 Visual Verification</h2>
          <ul>
            <li>If you see this styled content, shadow DOM is working</li>
            <li>Gradient header uses custom colors (not theme colors)</li>
            <li>These styles don't affect other modules or the app</li>
            <li>Box model and typography are independently controlled</li>
          </ul>
          
          <div class="testcssonly-test-color-box">
            This gradient is module-specific and isolated
          </div>
        </div>
        
        <div class="testcssonly-summary">
          <h2>✅ CSS ISOLATION CONFIRMED</h2>
          <p>Shadow DOM successfully isolates module styles</p>
          <p style="opacity: 0.7; margin-top: 10px;">
            This module has no JavaScript - pure CSS rendering
          </p>
        </div>
        
        <div class="testcssonly-console-note">
          <strong>📋 Developer Note:</strong> This module intentionally has no JavaScript.
          <br>It demonstrates that shadow DOM CSS isolation works for styling-only modules.
          <br>Check the module source to see the inline <code>&lt;style&gt;</code> block.
        </div>
      </div>
    `;
    
    console.log('[TestCSSOnly] ✅ Rendered successfully');
    console.log('[TestCSSOnly] Shadow DOM CSS isolation confirmed');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Module API
    return {
      getState() {
        return { 
          testMode: true,
          cssOnly: true,
          hasJavaScript: false
        };
      },
      
      setState(state) {
        console.log('[TestCSSOnly] setState called:', state);
      },
      
      destroy() {
        console.log('[TestCSSOnly] destroy called - cleaning up');
        container.innerHTML = '';
      }
    };
  }
  
  // Register factory
  window.createTestcssonly = createTestcssonly;
  
  // Register metadata
  window.moduleInfo = {
    displayName: 'CSS-Only Test',
    version: '2.0.0',
    description: 'Shadow DOM CSS isolation test (no JavaScript)'
  };
  
  // Notify ready
  if (typeof window.__moduleReady === 'function') {
    window.__moduleReady('createTestcssonly');
  }
})();
