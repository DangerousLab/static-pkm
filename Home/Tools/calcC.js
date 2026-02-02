(function () {
  function createCalcC(options) {
    const root = options.root;

    console.log('[CalcC] Initializing');

    // ==================== INLINE STYLES ====================
    const styles = `
      .calcc-calculator-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 18px;
      }

      .calcc-calculator-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .calcc-calculator-title-row h1 {
        font-size: 1.5rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        margin: 0;
        white-space: normal;
        line-height: 1.2;
      }

      .calcc-subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        max-width: 660px;
      }

      .calcc-subtitle span {
        display: block;
      }

      .calcc-panel {
        border-radius: 14px;
        border: 1px solid rgba(160, 160, 160, 0.55);
        background: var(--bg-panel);
        padding: 16px 16px 18px;
      }

      :root[data-theme="light"] .calcc-panel {
        border-color: rgba(148, 163, 184, 0.7);
      }

      .calcc-panel-title {
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 8px;
      }

      /* Responsive */
      @media (max-width: 600px) and (orientation: portrait) {
        .calcc-calculator-header {
          gap: 4px;
          margin-bottom: 12px;
        }

        .calcc-calculator-title-row h1 {
          font-size: 1.3rem;
        }

        .calcc-panel {
          padding: 12px 10px 14px;
          border-radius: 12px;
        }
      }
    `;

    const container = document.createElement('div');
    container.className = 'calcc-root';

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    container.appendChild(styleEl);

    container.innerHTML += `
      <div class="calcc-calculator-header">
        <div class="calcc-calculator-title-row">
          <h1>Longer Sidebar Title Length Test</h1>
        </div>
        <p class="calcc-subtitle"><span>Five-word title for overflow behavior.</span></p>
      </div>
      <div class="calcc-panel">
        <div class="calcc-panel-title">Content</div>
        <p class="calcc-subtitle">This is a dummy calculator module (C).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcC] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcC] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcC] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcC] Setting state:', state);
      }
    };
  }

  window.createCalcC = createCalcC;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcC');
  }
})();