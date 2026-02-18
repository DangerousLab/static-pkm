// debugModule.js - Simple module to test loading mechanism
(function () {
  'use strict';

  function createDebugModule(options) {
    const container = options.container;

    console.log('[DebugModule] ====== FACTORY CALLED ======');
    console.log('[DebugModule] Container received:', container);
    console.log('[DebugModule] Container tagName:', container?.tagName);
    console.log('[DebugModule] Container className:', container?.className);
    console.log('[DebugModule] Container parentElement:', container?.parentElement);
    console.log('[DebugModule] Container isConnected:', container?.isConnected);
    console.log('[DebugModule] Container innerHTML before:', container?.innerHTML);

    // Create simple content
    const content = document.createElement('div');
    content.style.padding = '20px';
    content.style.background = 'rgba(0, 255, 0, 0.1)';
    content.style.border = '2px solid green';
    content.style.borderRadius = '8px';
    content.innerHTML = `
      <h1 style="color: var(--text-main); margin: 0 0 10px 0;">Debug Module Loaded!</h1>
      <p style="color: var(--text-muted);">If you see this, the module loading is working.</p>
      <p style="color: var(--text-muted);">Timestamp: ${new Date().toISOString()}</p>
    `;

    // Append to container
    container.appendChild(content);

    console.log('[DebugModule] Content appended');
    console.log('[DebugModule] Container innerHTML after:', container?.innerHTML?.substring(0, 200));
    console.log('[DebugModule] Container children count:', container?.children?.length);
    console.log('[DebugModule] ====== FACTORY COMPLETE ======');

    return {
      destroy() {
        console.log('[DebugModule] ====== DESTROY CALLED ======');
        container.innerHTML = '';
      }
    };
  }

  // Register on window
  window.createDebugModule = createDebugModule;
  console.log('[DebugModule] Factory registered on window.createDebugModule');

  // Legacy callback pattern
  if (window.__moduleReady) {
    window.__moduleReady('createDebugModule');
  }
})();
