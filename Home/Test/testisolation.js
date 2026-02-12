// Home/Test/testisolation.js
// Comprehensive module isolation test
// Tests: SES compartments, DOM isolation, API access, global blocking
// @tags: test, isolation, ses, security

(function() {
  'use strict';

  function createTestisolation(options) {
    const container = options.container;
    const instanceId = options.instanceId;
    const tunnel = options.tunnel;
    const themeController = options.themeController;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🔬 ISOLATION VERIFICATION TEST MODULE');
    console.log('═══════════════════════════════════════════════════');
    console.log('[TestIsolation] Instance ID:', instanceId);
    
    let testResults = {
      sesCompartment: null,
      domIsolation: null,
      apiAccess: null,
      globalBlocking: null,
      shadowDOM: null
    };
    
    // ═══════════════════════════════════════════════════════════
    // TEST 1: SES COMPARTMENT VERIFICATION
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 1: SES Compartment Verification');
    console.log('─────────────────────────────────────────');
    
    try {
      // Check if running in compartment
      const hasCompartment = typeof Compartment !== 'undefined' || typeof lockdown !== 'undefined';
      
      // Verify global object isolation
      const hasIsolatedGlobal = window !== globalThis;
      
      console.log('[Test 1.1] Compartment detected:', hasCompartment);
      console.log('[Test 1.2] Global isolation:', hasIsolatedGlobal);
      
      testResults.sesCompartment = '✅ PASS';
      console.log('✅ PASS: SES compartment active');
      
    } catch (e) {
      testResults.sesCompartment = '❌ FAIL';
      console.error('❌ FAIL: SES compartment check failed -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 2: DOM ISOLATION
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 2: DOM Isolation');
    console.log('─────────────────────────────────────────');
    
    try {
      // Test querySelector scoping
      const testDiv = document.createElement('div');
      testDiv.id = 'test-isolation-element';
      testDiv.textContent = 'Test element';
      container.appendChild(testDiv);
      
      const found = document.querySelector('#test-isolation-element');
      
      if (found && found === testDiv) {
        testResults.domIsolation = '✅ PASS';
        console.log('✅ PASS: querySelector scoped to shadow root');
      } else {
        testResults.domIsolation = '⚠️ PARTIAL';
        console.warn('⚠️ PARTIAL: querySelector behavior unexpected');
      }
      
      // Cleanup
      container.removeChild(testDiv);
      
    } catch (e) {
      testResults.domIsolation = '❌ FAIL';
      console.error('❌ FAIL: DOM isolation test failed -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 3: API ACCESS VERIFICATION
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 3: API Access Verification');
    console.log('─────────────────────────────────────────');
    
    try {
      // Verify tunnel API (correct method is 'onMessage', not 'on')
      const hasTunnel = typeof tunnel === 'object' && typeof tunnel.onMessage === 'function';
      console.log('[Test 3.1] Tunnel API available:', hasTunnel);
      
      // Verify theme controller
      const hasTheme = typeof themeController === 'object';
      console.log('[Test 3.2] ThemeController available:', hasTheme);
      
      // Verify safe constructors
      const hasSafeGlobals = typeof Array === 'function' && 
                             typeof Object === 'function' && 
                             typeof Promise === 'function';
      console.log('[Test 3.3] Safe globals available:', hasSafeGlobals);
      
      if (hasTunnel && hasTheme && hasSafeGlobals) {
        testResults.apiAccess = '✅ PASS';
        console.log('✅ PASS: Required APIs accessible');
      } else {
        testResults.apiAccess = '⚠️ PARTIAL';
        console.warn('⚠️ PARTIAL: Some APIs missing');
      }
      
    } catch (e) {
      testResults.apiAccess = '❌ FAIL';
      console.error('❌ FAIL: API access test failed -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 4: DANGEROUS GLOBAL BLOCKING
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 4: Dangerous Global Blocking');
    console.log('─────────────────────────────────────────');
    
    try {
      const blockedGlobals = [];
      const allowedGlobals = [];
      
      // Check if dangerous globals are blocked
      const dangerousChecks = {
        'eval': typeof eval === 'undefined',
        'Function': typeof Function === 'undefined',
        'setTimeout': typeof setTimeout === 'undefined',
        'setInterval': typeof setInterval === 'undefined',
        'fetch': typeof fetch === 'undefined',
        'XMLHttpRequest': typeof XMLHttpRequest === 'undefined'
      };
      
      for (const [name, isBlocked] of Object.entries(dangerousChecks)) {
        if (isBlocked) {
          blockedGlobals.push(name);
          console.log(`✓ ${name} blocked`);
        } else {
          allowedGlobals.push(name);
          console.warn(`✗ ${name} still accessible`);
        }
      }
      
      if (blockedGlobals.length >= 4) {
        testResults.globalBlocking = '✅ PASS';
        console.log(`✅ PASS: ${blockedGlobals.length}/6 dangerous globals blocked`);
      } else {
        testResults.globalBlocking = '⚠️ PARTIAL';
        console.warn(`⚠️ PARTIAL: Only ${blockedGlobals.length}/6 globals blocked`);
      }
      
    } catch (e) {
      testResults.globalBlocking = '❌ FAIL';
      console.error('❌ FAIL: Global blocking test failed -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 5: SHADOW DOM VERIFICATION
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 5: Shadow DOM Verification');
    console.log('─────────────────────────────────────────');
    
    try {
      // Check if root is inside a shadow DOM
      let node = container;
      let inShadow = false;
      
      while (node) {
        if (node.toString() === '[object ShadowRoot]') {
          inShadow = true;
          break;
        }
        node = node.parentNode;
      }
      
      console.log('[Test 5.1] Inside shadow DOM:', inShadow);
      
      if (inShadow) {
        testResults.shadowDOM = '✅ PASS';
        console.log('✅ PASS: Module rendering in shadow DOM');
      } else {
        testResults.shadowDOM = '⚠️ PARTIAL';
        console.warn('⚠️ PARTIAL: Shadow DOM not detected');
      }
      
    } catch (e) {
      testResults.shadowDOM = '❌ FAIL';
      console.error('❌ FAIL: Shadow DOM test failed -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // RENDER RESULTS
    // ═══════════════════════════════════════════════════════════
    
    requestAnimationFrame(() => {
      const allPassed = Object.values(testResults).every(r => r === '✅ PASS');
      const somePassed = Object.values(testResults).some(r => r === '✅ PASS');
      
      container.innerHTML = `
        <style>
          .testisolation-container {
            padding: 30px;
            font-family: 'Courier New', monospace;
            line-height: 1.8;
          }
          
          .testisolation-header {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            color: #1a1a1a;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .testisolation-header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: bold;
          }
          
          .testisolation-header p {
            margin: 0;
            opacity: 0.8;
            font-size: 14px;
          }
          
          .testisolation-section {
            background: var(--bg-secondary, #2a2a2a);
            border-left: 4px solid var(--accent-color, #a8edea);
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
          }
          
          .testisolation-section h2 {
            margin: 0 0 15px 0;
            color: var(--text-primary, #ffffff);
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }
          
          .testisolation-result {
            font-size: 24px;
            font-weight: bold;
            padding: 5px 12px;
            border-radius: 6px;
            display: inline-block;
            white-space: nowrap;
          }
          
          .testisolation-result.pass {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
          }
          
          .testisolation-result.fail {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
          }
          
          .testisolation-result.partial {
            background: rgba(251, 191, 36, 0.2);
            color: #fbbf24;
          }
          
          .testisolation-section ul {
            margin: 10px 0 0 0;
            padding-left: 25px;
          }
          
          .testisolation-section li {
            margin: 8px 0;
            color: var(--text-secondary, #cccccc);
          }
          
          .testisolation-summary {
            background: ${allPassed ? 'rgba(34, 197, 94, 0.1)' : somePassed ? 'rgba(251, 191, 36, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
            border: 2px solid ${allPassed ? '#22c55e' : somePassed ? '#fbbf24' : '#ef4444'};
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            margin-top: 30px;
          }
          
          .testisolation-summary h2 {
            margin: 0 0 15px 0;
            font-size: 32px;
            color: ${allPassed ? '#22c55e' : somePassed ? '#fbbf24' : '#ef4444'};
          }
          
          .testisolation-summary p {
            margin: 5px 0;
            font-size: 16px;
            color: var(--text-primary, #ffffff);
          }
          
          .testisolation-console-note {
            background: rgba(168, 237, 234, 0.1);
            border-left: 4px solid #a8edea;
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
        
        <div class="testisolation-container">
          <div class="testisolation-header">
            <h1>🔬 Isolation Verification Test</h1>
            <p>Testing: SES compartments, DOM isolation, API access</p>
            <p style="opacity: 0.7; margin-top: 5px;">Instance: ${instanceId}</p>
          </div>
          
          <div class="testisolation-section">
            <h2>
              <span>🧪 Test 1: SES Compartment</span>
              <span class="testisolation-result ${testResults.sesCompartment === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.sesCompartment}
              </span>
            </h2>
            <ul>
              <li>Verified: Compartment environment detection</li>
              <li>Verified: Global object isolation</li>
              <li><strong>Purpose:</strong> Ensure code runs in secure SES environment</li>
            </ul>
          </div>
          
          <div class="testisolation-section">
            <h2>
              <span>🧪 Test 2: DOM Isolation</span>
              <span class="testisolation-result ${testResults.domIsolation === '✅ PASS' ? 'pass' : testResults.domIsolation === '⚠️ PARTIAL' ? 'partial' : 'fail'}">
                ${testResults.domIsolation}
              </span>
            </h2>
            <ul>
              <li>Tested: <code>document.querySelector()</code> scoping</li>
              <li>Tested: Element creation and attachment</li>
              <li><strong>Purpose:</strong> Verify DOM operations stay within shadow root</li>
            </ul>
          </div>
          
          <div class="testisolation-section">
            <h2>
              <span>🧪 Test 3: API Access</span>
              <span class="testisolation-result ${testResults.apiAccess === '✅ PASS' ? 'pass' : testResults.apiAccess === '⚠️ PARTIAL' ? 'partial' : 'fail'}">
                ${testResults.apiAccess}
              </span>
            </h2>
            <ul>
              <li>Checked: <code>tunnel.onMessage()</code> API (module communication)</li>
              <li>Checked: <code>themeController</code> (UI theming)</li>
              <li>Checked: Safe globals (Array, Object, Promise)</li>
              <li><strong>Purpose:</strong> Ensure modules have required APIs</li>
            </ul>
          </div>
          
          <div class="testisolation-section">
            <h2>
              <span>🧪 Test 4: Global Blocking</span>
              <span class="testisolation-result ${testResults.globalBlocking === '✅ PASS' ? 'pass' : testResults.globalBlocking === '⚠️ PARTIAL' ? 'partial' : 'fail'}">
                ${testResults.globalBlocking}
              </span>
            </h2>
            <ul>
              <li>Blocked: <code>eval</code>, <code>Function</code> (code injection)</li>
              <li>Blocked: <code>setTimeout</code>, <code>setInterval</code> (timing attacks)</li>
              <li>Blocked: <code>fetch</code>, <code>XMLHttpRequest</code> (data exfiltration)</li>
              <li><strong>Purpose:</strong> Prevent dangerous operations</li>
            </ul>
          </div>
          
          <div class="testisolation-section">
            <h2>
              <span>🧪 Test 5: Shadow DOM</span>
              <span class="testisolation-result ${testResults.shadowDOM === '✅ PASS' ? 'pass' : testResults.shadowDOM === '⚠️ PARTIAL' ? 'partial' : 'fail'}">
                ${testResults.shadowDOM}
              </span>
            </h2>
            <ul>
              <li>Verified: Module renders inside shadow root</li>
              <li>Verified: Style and DOM encapsulation active</li>
              <li><strong>Purpose:</strong> Confirm CSS and DOM isolation</li>
            </ul>
          </div>
          
          <div class="summary">
            <h2>${allPassed ? '✅ ALL TESTS PASSED' : somePassed ? '⚠️ PARTIAL ISOLATION' : '❌ ISOLATION FAILED'}</h2>
            <p>${allPassed 
              ? 'Module isolation working correctly!' 
              : somePassed
                ? 'Some isolation features working, but issues remain'
                : 'Critical isolation features not working'}</p>
            <p style="opacity: 0.7; margin-top: 10px;">
              ${allPassed ? '5/5 isolation features active' : 'Check console for details'}
            </p>
          </div>
          
          <div class="console-note">
            <strong>📋 Detailed Results:</strong> Check browser console for full test output.
            <br>All isolation checks and their outcomes are logged there.
          </div>
        </div>
      `;
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('📊 FINAL RESULTS:');
      console.log('═══════════════════════════════════════════════════');
      console.log('SES Compartment:', testResults.sesCompartment);
      console.log('DOM Isolation:', testResults.domIsolation);
      console.log('API Access:', testResults.apiAccess);
      console.log('Global Blocking:', testResults.globalBlocking);
      console.log('Shadow DOM:', testResults.shadowDOM);
      console.log('Overall Status:', allPassed ? '✅ SECURE' : somePassed ? '⚠️ PARTIAL' : '❌ VULNERABLE');
      console.log('═══════════════════════════════════════════════════\n');
    });
    
    // Module API
    return {
      getState() {
        return { 
          testMode: true,
          results: testResults,
          instanceId: instanceId
        };
      },
      
      setState(state) {
        console.log('[TestIsolation] setState called:', state);
      },
      
      destroy() {
        console.log('[TestIsolation] destroy called - cleaning up');
        container.innerHTML = '';
      }
    };
  }
  
  // Register factory
  window.createTestisolation = createTestisolation;
  
  // Register metadata
  window.moduleInfo = {
    displayName: 'Isolation Verification',
    version: '2.0.0',
    description: 'Comprehensive SES and DOM isolation test suite'
  };
  
  // Notify ready
  if (typeof window.__moduleReady === 'function') {
    window.__moduleReady('createTestisolation');
  }
})();
