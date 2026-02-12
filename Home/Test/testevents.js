// Home/Test/testevents.js
// Event system isolation test module
// Tests: addEventListener/dispatchEvent scoping and restrictions
// @tags: test, security, events, isolation

(function() {
  'use strict';

  function createTestevents(options) {
    const container = options.container;
    const instanceId = options.instanceId;
    const tunnel = options.tunnel;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🎯 EVENT SYSTEM ISOLATION TEST MODULE');
    console.log('═══════════════════════════════════════════════════');
    console.log('[TestEvents] Instance ID:', instanceId);
    
    let testResults = {
      globalEventBlocking: null,
      instanceEventAllowing: null,
      dispatchBlocking: null,
      dispatchAllowing: null,
      safeGlobalEvents: null
    };
    
    let eventFired = false;
    let instanceEventFired = false;
    
    // ═══════════════════════════════════════════════════════════
    // TEST 1: GLOBAL EVENT LISTENING (Should be BLOCKED)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 1: Global Event Listener Blocking');
    console.log('─────────────────────────────────────────');
    
    try {
      const spyHandler = () => {
        console.error('❌ SECURITY BREACH: Intercepted global event!');
        eventFired = true;
      };
      
      console.log('[Test 1.1] Attempting: addEventListener("sidebarRenderNeeded", handler)');
      window.addEventListener('sidebarRenderNeeded', spyHandler);
      
      // Try to trigger it
      window.dispatchEvent(new CustomEvent('sidebarRenderNeeded', { 
        detail: { sensitive: 'data' } 
      }));
      
      // Wait a tick to see if handler was called (using rAF instead of setTimeout)
      requestAnimationFrame(() => {
        if (eventFired) {
          testResults.globalEventBlocking = '❌ FAIL';
          console.error('❌ FAIL: Global event listener was executed - modules can spy!');
        } else {
          testResults.globalEventBlocking = '✅ PASS';
          console.log('✅ PASS: Global event listener was blocked');
        }
      });
      
      // If we got here without console warning, the listener was added (bad)
      // Check console output to be sure
      testResults.globalEventBlocking = '✅ PASS';  // Will be updated if event fires
      
    } catch (e) {
      testResults.globalEventBlocking = '✅ PASS';
      console.log('✅ PASS: Global event listener threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 2: INSTANCE-SPECIFIC EVENT LISTENING (Should be ALLOWED)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 2: Instance-Specific Event Allowing');
    console.log('─────────────────────────────────────────');
    
    try {
      const instanceEventName = `${instanceId}:testEvent`;
      
      const instanceHandler = (e) => {
        console.log('✓ Instance event received:', e.detail);
        instanceEventFired = true;
      };
      
      console.log(`[Test 2.1] Attempting: addEventListener("${instanceEventName}", handler)`);
      window.addEventListener(instanceEventName, instanceHandler);
      
      // Try to dispatch it
      console.log(`[Test 2.2] Dispatching instance event: ${instanceEventName}`);
      const dispatched = window.dispatchEvent(new CustomEvent(instanceEventName, {
        detail: { test: 'data' }
      }));
      
      // Check if it worked (using rAF instead of setTimeout)
      requestAnimationFrame(() => {
        if (instanceEventFired && dispatched !== false) {
          testResults.instanceEventAllowing = '✅ PASS';
          console.log('✅ PASS: Instance-specific events work correctly');
        } else {
          testResults.instanceEventAllowing = '❌ FAIL';
          console.error('❌ FAIL: Instance-specific events blocked (too restrictive)');
        }
      });
      
    } catch (e) {
      testResults.instanceEventAllowing = '❌ FAIL';
      console.error('❌ FAIL: Instance-specific events threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 3: GLOBAL EVENT DISPATCHING (Should be BLOCKED)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 3: Global Event Dispatch Blocking');
    console.log('─────────────────────────────────────────');
    
    try {
      console.log('[Test 3.1] Attempting: dispatchEvent(new CustomEvent("moduleDestroyed"))');
      const result = window.dispatchEvent(new CustomEvent('moduleDestroyed', {
        detail: { victim: 'otherModule' }
      }));
      
      // If result is false, dispatch was blocked (good)
      if (result === false) {
        testResults.dispatchBlocking = '✅ PASS';
        console.log('✅ PASS: Global event dispatch blocked (returned false)');
      } else {
        testResults.dispatchBlocking = '❌ FAIL';
        console.error('❌ FAIL: Global event dispatch succeeded - can inject fake events!');
      }
      
    } catch (e) {
      testResults.dispatchBlocking = '✅ PASS';
      console.log('✅ PASS: Global event dispatch threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 4: INSTANCE EVENT DISPATCHING (Should be ALLOWED)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 4: Instance Event Dispatch Allowing');
    console.log('─────────────────────────────────────────');
    
    try {
      const instanceEventName = `${instanceId}:customEvent`;
      
      console.log(`[Test 4.1] Attempting: dispatchEvent("${instanceEventName}")`);
      const result = window.dispatchEvent(new CustomEvent(instanceEventName, {
        detail: { allowed: true }
      }));
      
      if (result !== false) {
        testResults.dispatchAllowing = '✅ PASS';
        console.log('✅ PASS: Instance event dispatch allowed');
      } else {
        testResults.dispatchAllowing = '❌ FAIL';
        console.error('❌ FAIL: Instance event dispatch blocked (too restrictive)');
      }
      
    } catch (e) {
      testResults.dispatchAllowing = '❌ FAIL';
      console.error('❌ FAIL: Instance event dispatch threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 5: SAFE GLOBAL EVENTS (resize, scroll - Should be ALLOWED)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 5: Safe Browser Event Allowing');
    console.log('─────────────────────────────────────────');
    
    try {
      let resizeListenerAdded = false;
      let scrollListenerAdded = false;
      
      const resizeHandler = () => {
        console.log('✓ Resize event received');
      };
      
      const scrollHandler = () => {
        console.log('✓ Scroll event received');
      };
      
      console.log('[Test 5.1] Attempting: addEventListener("resize", handler)');
      try {
        window.addEventListener('resize', resizeHandler);
        resizeListenerAdded = true;
        console.log('✓ Resize listener added (allowed)');
      } catch (e) {
        console.error('✗ Resize listener blocked:', e.message);
      }
      
      console.log('[Test 5.2] Attempting: addEventListener("scroll", handler)');
      try {
        window.addEventListener('scroll', scrollHandler);
        scrollListenerAdded = true;
        console.log('✓ Scroll listener added (allowed)');
      } catch (e) {
        console.error('✗ Scroll listener blocked:', e.message);
      }
      
      if (resizeListenerAdded && scrollListenerAdded) {
        testResults.safeGlobalEvents = '✅ PASS';
        console.log('✅ PASS: Safe browser events (resize, scroll) are allowed');
      } else {
        testResults.safeGlobalEvents = '⚠️ PARTIAL';
        console.warn('⚠️ PARTIAL: Some safe browser events were blocked');
      }
      
    } catch (e) {
      testResults.safeGlobalEvents = '❌ FAIL';
      console.error('❌ FAIL: Safe browser events threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // RENDER RESULTS (with delay for async checks)
    // ═══════════════════════════════════════════════════════════
    
    // Use multiple rAF calls to ensure async checks complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const allPassed = Object.values(testResults).every(r => r === '✅ PASS');
        const somePassed = Object.values(testResults).some(r => r === '✅ PASS');
      
      container.innerHTML = `
        <style>
          .test-container {
            padding: 30px;
            font-family: 'Courier New', monospace;
            line-height: 1.8;
          }
          
          .test-header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .test-header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: bold;
          }
          
          .test-header p {
            margin: 0;
            opacity: 0.9;
            font-size: 14px;
          }
          
          .test-section {
            background: var(--bg-secondary, #2a2a2a);
            border-left: 4px solid var(--accent-color, #f5576c);
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
          }
          
          .test-section h2 {
            margin: 0 0 15px 0;
            color: var(--text-primary, #ffffff);
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }
          
          .test-result {
            font-size: 24px;
            font-weight: bold;
            padding: 5px 12px;
            border-radius: 6px;
            display: inline-block;
            white-space: nowrap;
          }
          
          .test-result.pass {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
          }
          
          .test-result.fail {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
          }
          
          .test-result.partial {
            background: rgba(251, 191, 36, 0.2);
            color: #fbbf24;
          }
          
          .test-section ul {
            margin: 10px 0 0 0;
            padding-left: 25px;
          }
          
          .test-section li {
            margin: 8px 0;
            color: var(--text-secondary, #cccccc);
          }
          
          .summary {
            background: ${allPassed ? 'rgba(34, 197, 94, 0.1)' : somePassed ? 'rgba(251, 191, 36, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
            border: 2px solid ${allPassed ? '#22c55e' : somePassed ? '#fbbf24' : '#ef4444'};
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            margin-top: 30px;
          }
          
          .summary h2 {
            margin: 0 0 15px 0;
            font-size: 32px;
            color: ${allPassed ? '#22c55e' : somePassed ? '#fbbf24' : '#ef4444'};
          }
          
          .summary p {
            margin: 5px 0;
            font-size: 16px;
            color: var(--text-primary, #ffffff);
          }
          
          .console-note {
            background: rgba(245, 87, 108, 0.1);
            border-left: 4px solid #f5576c;
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
          
          .warning-box {
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid #fbbf24;
            padding: 15px;
            margin-top: 15px;
            border-radius: 6px;
            font-size: 13px;
          }
        </style>
        
        <div class="test-container">
          <div class="test-header">
            <h1>🎯 Event System Isolation Test</h1>
            <p>Testing: addEventListener/dispatchEvent scoping</p>
            <p style="opacity: 0.7; margin-top: 5px;">Instance: ${instanceId}</p>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 1: Block Global Event Spying</span>
              <span class="test-result ${testResults.globalEventBlocking === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.globalEventBlocking || '⏳ PENDING'}
              </span>
            </h2>
            <ul>
              <li>Attempted: <code>addEventListener("sidebarRenderNeeded", handler)</code></li>
              <li><strong>Expected:</strong> Listener blocked or not executed</li>
              <li><strong>Security:</strong> Prevents modules from intercepting app events</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 2: Allow Instance Events</span>
              <span class="test-result ${testResults.instanceEventAllowing === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.instanceEventAllowing || '⏳ PENDING'}
              </span>
            </h2>
            <ul>
              <li>Attempted: <code>addEventListener("${instanceId}:testEvent", handler)</code></li>
              <li><strong>Expected:</strong> Listener works for own events</li>
              <li><strong>Use Case:</strong> Internal module communication</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 3: Block Global Event Injection</span>
              <span class="test-result ${testResults.dispatchBlocking === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.dispatchBlocking || '⏳ PENDING'}
              </span>
            </h2>
            <ul>
              <li>Attempted: <code>dispatchEvent(new CustomEvent("moduleDestroyed"))</code></li>
              <li><strong>Expected:</strong> Dispatch returns false or blocked</li>
              <li><strong>Security:</strong> Prevents fake events affecting other modules</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 4: Allow Instance Event Dispatch</span>
              <span class="test-result ${testResults.dispatchAllowing === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.dispatchAllowing || '⏳ PENDING'}
              </span>
            </h2>
            <ul>
              <li>Attempted: <code>dispatchEvent("${instanceId}:customEvent")</code></li>
              <li><strong>Expected:</strong> Dispatch succeeds for own events</li>
              <li><strong>Use Case:</strong> Notify own listeners</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 5: Allow Safe Browser Events</span>
              <span class="test-result ${testResults.safeGlobalEvents === '✅ PASS' ? 'pass' : testResults.safeGlobalEvents === '⚠️ PARTIAL' ? 'partial' : 'fail'}">
                ${testResults.safeGlobalEvents || '⏳ PENDING'}
              </span>
            </h2>
            <ul>
              <li>Tested: <code>addEventListener("resize", handler)</code></li>
              <li>Tested: <code>addEventListener("scroll", handler)</code></li>
              <li><strong>Expected:</strong> Safe browser events are allowed</li>
              <li><strong>Use Case:</strong> Responsive UI updates</li>
            </ul>
          </div>
          
          <div class="summary">
            <h2>${allPassed ? '✅ ALL TESTS PASSED' : somePassed ? '⚠️ PARTIAL ISOLATION' : '❌ ISOLATION FAILED'}</h2>
            <p>${allPassed 
              ? 'Event system isolation working correctly!' 
              : somePassed
                ? 'Some event restrictions working, but issues remain'
                : 'Event system needs isolation fixes'}</p>
            <p style="opacity: 0.7; margin-top: 10px;">
              ${allPassed ? '5/5 event security features active' : 'Check console for details'}
            </p>
          </div>
          
          ${!allPassed ? `
            <div class="warning-box">
              <strong>⚠️ Recommended Actions:</strong>
              <ul style="margin: 10px 0 0 20px; padding: 0;">
                <li>Apply Fix #2 to <code>javascript/core/dom-isolation.js</code></li>
                <li>Refactor modules using global events to use <code>tunnel.on()</code> instead</li>
                <li>Prefix custom window events with instance ID: <code>${instanceId}:eventName</code></li>
              </ul>
            </div>
          ` : ''}
          
          <div class="console-note">
            <strong>📋 Detailed Results:</strong> Check browser console for full test output.
            <br>All event listener attempts and their outcomes are logged there.
          </div>
        </div>
      `;
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('📊 FINAL RESULTS:');
      console.log('═══════════════════════════════════════════════════');
      console.log('Global Event Blocking:', testResults.globalEventBlocking);
      console.log('Instance Event Allowing:', testResults.instanceEventAllowing);
      console.log('Global Dispatch Blocking:', testResults.dispatchBlocking);
      console.log('Instance Dispatch Allowing:', testResults.dispatchAllowing);
      console.log('Safe Browser Events:', testResults.safeGlobalEvents);
      console.log('Overall Status:', allPassed ? '✅ SECURE' : somePassed ? '⚠️ PARTIAL' : '❌ VULNERABLE');
      console.log('═══════════════════════════════════════════════════\n');
      
      });  // End second rAF
    });  // End first rAF - provides small delay for async event checks
    
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
        console.log('[TestEvents] setState called:', state);
      },
      
      destroy() {
        console.log('[TestEvents] destroy called - cleaning up');
        container.innerHTML = '';
      }
    };
  }
  
  // Register factory
  window.createTestevents = createTestevents;
  
  // Register metadata
  window.moduleInfo = {
    displayName: 'Event Isolation Test',
    version: '1.0.0',
    description: 'Tests addEventListener/dispatchEvent scoping and security'
  };
  
  // Notify ready
  if (typeof window.__moduleReady === 'function') {
    window.__moduleReady('createTestevents');
  }
})();
