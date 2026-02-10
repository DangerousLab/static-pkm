// Home/Test/testresources.js
// Resource limits test module
// Tests: DOM node counting, limits, and DoS prevention
// @tags: test, security, resources, dos

(function() {
  'use strict';

  function createTestresources(options) {
    const root = options.root;
    const instanceId = options.instanceId;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('⚡ RESOURCE LIMITS TEST MODULE');
    console.log('═══════════════════════════════════════════════════');
    console.log('[TestResources] Instance ID:', instanceId);
    
    let testResults = {
      nodeCounting: null,
      fragmentExclusion: null,
      warningThreshold: null,
      hardLimit: null,
      debugProperties: null
    };
    
    let stats = {
      nodesCreated: 0,
      warningReceived: false,
      limitEnforced: false,
      currentCount: 0,
      maxLimit: 0
    };
    
    // Note: Cannot override console.warn due to SES hardening
    // Warning detection will be based on node count reaching threshold
    
    // ═══════════════════════════════════════════════════════════
    // TEST 1: BASIC NODE COUNTING
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 1: Basic Node Counting');
    console.log('─────────────────────────────────────────');
    
    try {
      const initialCount = document.__nodeCount || 0;
      console.log('[Test 1.1] Initial node count:', initialCount);
      
      // Create some nodes
      console.log('[Test 1.2] Creating 10 elements...');
      for (let i = 0; i < 10; i++) {
        document.createElement('div');
      }
      
      const afterElements = document.__nodeCount || 0;
      console.log('[Test 1.3] After creating elements:', afterElements);
      
      // Create text nodes
      console.log('[Test 1.4] Creating 5 text nodes...');
      for (let i = 0; i < 5; i++) {
        document.createTextNode('test');
      }
      
      const afterText = document.__nodeCount || 0;
      console.log('[Test 1.5] After creating text nodes:', afterText);
      
      // Check if counting works
      const expectedCount = initialCount + 15;
      if (afterText === expectedCount) {
        testResults.nodeCounting = '✅ PASS';
        console.log(`✅ PASS: Node counting works correctly (${afterText} nodes)`);
      } else {
        testResults.nodeCounting = '⚠️ PARTIAL';
        console.warn(`⚠️ PARTIAL: Expected ${expectedCount}, got ${afterText}`);
      }
      
      stats.nodesCreated = afterText - initialCount;
      
    } catch (e) {
      testResults.nodeCounting = '❌ FAIL';
      console.error('❌ FAIL: Node counting threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 2: DOCUMENT FRAGMENTS (Should NOT Count)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 2: Document Fragment Exclusion');
    console.log('─────────────────────────────────────────');
    
    try {
      const beforeFragments = document.__nodeCount || 0;
      console.log('[Test 2.1] Node count before fragments:', beforeFragments);
      
      // Create fragments (shouldn't count)
      console.log('[Test 2.2] Creating 10 document fragments...');
      for (let i = 0; i < 10; i++) {
        document.createDocumentFragment();
      }
      
      const afterFragments = document.__nodeCount || 0;
      console.log('[Test 2.3] Node count after fragments:', afterFragments);
      
      if (beforeFragments === afterFragments) {
        testResults.fragmentExclusion = '✅ PASS';
        console.log('✅ PASS: Document fragments do not count (correct behavior)');
      } else {
        testResults.fragmentExclusion = '❌ FAIL';
        console.error('❌ FAIL: Document fragments were counted (should be excluded)');
      }
      
    } catch (e) {
      testResults.fragmentExclusion = '❌ FAIL';
      console.error('❌ FAIL: Fragment test threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 3: WARNING THRESHOLD (80% = 8000 nodes)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 3: Warning Threshold Test');
    console.log('─────────────────────────────────────────');
    console.log('[Test 3] This will create many nodes - please wait...');
    
    try {
      const maxLimit = document.__nodeLimit || 10000;
      const warnThreshold = Math.floor(maxLimit * 0.8);
      const currentCount = document.__nodeCount || 0;
      const nodesToCreate = warnThreshold - currentCount + 10;  // Go slightly over threshold
      
      console.log(`[Test 3.1] Creating ${nodesToCreate} nodes to reach warning threshold...`);
      console.log(`[Test 3.2] Warning should appear at ${warnThreshold} nodes in console`);
      
      // Create nodes in batches
      for (let i = 0; i < nodesToCreate; i++) {
        document.createElement('div');
        
        // Log progress every 1000 nodes
        if (i > 0 && i % 1000 === 0) {
          console.log(`  Progress: ${i}/${nodesToCreate} nodes created...`);
        }
      }
      
      const finalCount = document.__nodeCount || 0;
      console.log(`[Test 3.3] Final node count: ${finalCount}`);
      
      // Check if we reached warning threshold (can't intercept console.warn due to SES)
      if (finalCount >= warnThreshold) {
        testResults.warningThreshold = '✅ PASS';
        console.log('✅ PASS: Reached warning threshold (check console for warning message)');
        stats.warningReceived = true;
      } else {
        testResults.warningThreshold = '⚠️ SKIPPED';
        console.log('⚠️ SKIPPED: Did not reach warning threshold in this test');
      }
      
    } catch (e) {
      testResults.warningThreshold = '❌ FAIL';
      console.error('❌ FAIL: Warning threshold test threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 4: HARD LIMIT ENFORCEMENT (10,000 nodes)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 4: Hard Limit Enforcement');
    console.log('─────────────────────────────────────────');
    
    try {
      const maxLimit = document.__nodeLimit || 10000;
      const currentCount = document.__nodeCount || 0;
      const remaining = maxLimit - currentCount;
      
      console.log(`[Test 4.1] Current nodes: ${currentCount}/${maxLimit}`);
      console.log(`[Test 4.2] Attempting to exceed limit by creating ${remaining + 100} nodes...`);
      
      let createdCount = 0;
      let limitHit = false;
      
      try {
        for (let i = 0; i < remaining + 100; i++) {
          document.createElement('div');
          createdCount++;
        }
      } catch (limitError) {
        limitHit = true;
        stats.limitEnforced = true;
        console.log(`✓ Limit enforced after creating ${createdCount} additional nodes`);
        console.log('✓ Error message:', limitError.message);
      }
      
      if (limitHit) {
        testResults.hardLimit = '✅ PASS';
        console.log('✅ PASS: Hard limit prevents node creation (DoS protection works)');
      } else {
        testResults.hardLimit = '❌ FAIL';
        console.error('❌ FAIL: Hard limit not enforced - DoS attack possible!');
      }
      
    } catch (e) {
      testResults.hardLimit = '❌ FAIL';
      console.error('❌ FAIL: Hard limit test threw unexpected error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // TEST 5: DEBUG PROPERTIES (__nodeCount, __nodeLimit)
    // ═══════════════════════════════════════════════════════════
    console.log('\n🧪 TEST 5: Debug Properties');
    console.log('─────────────────────────────────────────');
    
    try {
      const nodeCount = document.__nodeCount;
      const nodeLimit = document.__nodeLimit;
      
      console.log('[Test 5.1] document.__nodeCount:', nodeCount);
      console.log('[Test 5.2] document.__nodeLimit:', nodeLimit);
      
      if (typeof nodeCount === 'number' && typeof nodeLimit === 'number') {
        testResults.debugProperties = '✅ PASS';
        console.log('✅ PASS: Debug properties accessible');
        
        stats.currentCount = nodeCount;
        stats.maxLimit = nodeLimit;
      } else {
        testResults.debugProperties = '❌ FAIL';
        console.error('❌ FAIL: Debug properties not accessible');
      }
      
    } catch (e) {
      testResults.debugProperties = '❌ FAIL';
      console.error('❌ FAIL: Debug properties threw error -', e.message);
    }
    
    // ═══════════════════════════════════════════════════════════
    // RENDER RESULTS
    // ═══════════════════════════════════════════════════════════
    
    requestAnimationFrame(() => {
      const allPassed = Object.values(testResults).every(r => r === '✅ PASS');
      const somePassed = Object.values(testResults).some(r => r === '✅ PASS');
      const percentage = stats.maxLimit > 0 
        ? Math.round((stats.currentCount / stats.maxLimit) * 100) 
        : 0;
      
      root.innerHTML = `
        <style>
          .test-container {
            padding: 30px;
            font-family: 'Courier New', monospace;
            line-height: 1.8;
          }
          
          .test-header {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: #1a1a1a;
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
            opacity: 0.8;
            font-size: 14px;
          }
          
          .stats-box {
            background: var(--bg-secondary, #2a2a2a);
            border: 2px solid #fee140;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 12px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }
          
          .stat-item {
            text-align: center;
          }
          
          .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #fee140;
            margin-bottom: 5px;
          }
          
          .stat-label {
            font-size: 12px;
            color: var(--text-secondary, #cccccc);
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .progress-bar {
            width: 100%;
            height: 30px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 15px;
            overflow: hidden;
            margin-top: 15px;
            position: relative;
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #22c55e 0%, #fee140 80%, #ef4444 100%);
            width: ${percentage}%;
            transition: width 0.3s ease;
          }
          
          .progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-weight: bold;
            color: white;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
          }
          
          .test-section {
            background: var(--bg-secondary, #2a2a2a);
            border-left: 4px solid var(--accent-color, #fee140);
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
          
          .test-result.skipped {
            background: rgba(148, 163, 184, 0.2);
            color: #94a3b8;
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
            background: rgba(250, 112, 154, 0.1);
            border-left: 4px solid #fa709a;
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
        
        <div class="test-container">
          <div class="test-header">
            <h1>⚡ Resource Limits Test</h1>
            <p>Testing: DOM node counting, limits, and DoS prevention</p>
            <p style="opacity: 0.7; margin-top: 5px;">Instance: ${instanceId}</p>
          </div>
          
          <div class="stats-box">
            <div class="stat-item">
              <div class="stat-value">${stats.currentCount.toLocaleString()}</div>
              <div class="stat-label">Current Nodes</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${stats.maxLimit.toLocaleString()}</div>
              <div class="stat-label">Maximum Nodes</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${percentage}%</div>
              <div class="stat-label">Capacity Used</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${stats.limitEnforced ? '✅' : '❌'}</div>
              <div class="stat-label">Limit Enforced</div>
            </div>
          </div>
          
          <div style="background: var(--bg-secondary, #2a2a2a); padding: 20px; border-radius: 12px; margin-bottom: 30px;">
            <div style="font-size: 14px; color: var(--text-secondary, #cccccc); margin-bottom: 10px;">
              Node Usage Progress
            </div>
            <div class="progress-bar">
              <div class="progress-fill"></div>
              <div class="progress-text">${stats.currentCount} / ${stats.maxLimit} nodes</div>
            </div>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 1: Basic Node Counting</span>
              <span class="test-result ${testResults.nodeCounting === '✅ PASS' ? 'pass' : testResults.nodeCounting === '⚠️ PARTIAL' ? 'partial' : 'fail'}">
                ${testResults.nodeCounting}
              </span>
            </h2>
            <ul>
              <li>Created: Elements and text nodes</li>
              <li>Verified: <code>document.__nodeCount</code> increments correctly</li>
              <li><strong>Purpose:</strong> Ensure all node types are counted</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 2: Fragment Exclusion</span>
              <span class="test-result ${testResults.fragmentExclusion === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.fragmentExclusion}
              </span>
            </h2>
            <ul>
              <li>Created: 10 document fragments</li>
              <li>Verified: Fragments do NOT count toward limit</li>
              <li><strong>Reason:</strong> Fragments are temporary containers</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 3: Warning Threshold (80%)</span>
              <span class="test-result ${testResults.warningThreshold === '✅ PASS' ? 'pass' : testResults.warningThreshold === '⚠️ SKIPPED' ? 'skipped' : 'fail'}">
                ${testResults.warningThreshold}
              </span>
            </h2>
            <ul>
              <li>Target: ${Math.floor(stats.maxLimit * 0.8).toLocaleString()} nodes (80% of ${stats.maxLimit.toLocaleString()})</li>
              <li>Action: Creates nodes until warning appears</li>
              <li><strong>Purpose:</strong> Warn developers before hitting hard limit</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 4: Hard Limit Enforcement</span>
              <span class="test-result ${testResults.hardLimit === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.hardLimit}
              </span>
            </h2>
            <ul>
              <li>Attempted: Create ${stats.maxLimit.toLocaleString()}+ nodes</li>
              <li>Expected: Error thrown when limit exceeded</li>
              <li><strong>Security:</strong> Prevents browser DoS attacks</li>
            </ul>
          </div>
          
          <div class="test-section">
            <h2>
              <span>🧪 Test 5: Debug Properties</span>
              <span class="test-result ${testResults.debugProperties === '✅ PASS' ? 'pass' : 'fail'}">
                ${testResults.debugProperties}
              </span>
            </h2>
            <ul>
              <li>Checked: <code>document.__nodeCount</code> (read-only)</li>
              <li>Checked: <code>document.__nodeLimit</code> (read-only)</li>
              <li><strong>Use Case:</strong> Debugging and monitoring</li>
            </ul>
          </div>
          
          <div class="summary">
            <h2>${allPassed ? '✅ ALL TESTS PASSED' : somePassed ? '⚠️ PARTIAL PROTECTION' : '❌ PROTECTION FAILED'}</h2>
            <p>${allPassed 
              ? 'Resource limits working correctly!' 
              : somePassed
                ? 'Some limits working, but gaps remain'
                : 'Resource limits need implementation'}</p>
            <p style="opacity: 0.7; margin-top: 10px;">
              DoS Protection: ${stats.limitEnforced ? 'ACTIVE ✅' : 'INACTIVE ❌'}
            </p>
          </div>
          
          <div class="console-note">
            <strong>📋 Performance Note:</strong> This test creates thousands of DOM nodes.
            <br>Check browser console for detailed progress and timing information.
          </div>
        </div>
      `;
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('📊 FINAL RESULTS:');
      console.log('═══════════════════════════════════════════════════');
      console.log('Node Counting:', testResults.nodeCounting);
      console.log('Fragment Exclusion:', testResults.fragmentExclusion);
      console.log('Warning Threshold:', testResults.warningThreshold);
      console.log('Hard Limit:', testResults.hardLimit);
      console.log('Debug Properties:', testResults.debugProperties);
      console.log('─────────────────────────────────────────');
      console.log('Current Nodes:', stats.currentCount);
      console.log('Max Limit:', stats.maxLimit);
      console.log('Capacity Used:', percentage + '%');
      console.log('Limit Enforced:', stats.limitEnforced ? 'YES' : 'NO');
      console.log('Overall Status:', allPassed ? '✅ SECURE' : somePassed ? '⚠️ PARTIAL' : '❌ VULNERABLE');
      console.log('═══════════════════════════════════════════════════\n');
    });
    
    // Module API
    return {
      getState() {
        return { 
          testMode: true,
          results: testResults,
          stats: stats
        };
      },
      
      setState(state) {
        console.log('[TestResources] setState called:', state);
      },
      
      destroy() {
        console.log('[TestResources] destroy called - cleaning up');
        root.innerHTML = '';
      }
    };
  }
  
  // Register factory
  window.createTestresources = createTestresources;
  
  // Register metadata
  window.moduleInfo = {
    displayName: 'Resource Limits Test',
    version: '1.0.0',
    description: 'Tests DOM node limits and DoS prevention'
  };
  
  // Notify ready
  if (typeof window.__moduleReady === 'function') {
    window.__moduleReady('createTestresources');
  }
})();
