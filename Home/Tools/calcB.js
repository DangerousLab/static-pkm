(function () {
  function createCalcB(options) {
    const root = options.root;

    console.log('[CalcB] Initializing');

    // ==================== INLINE STYLES ====================
    const styles = `
      .calcb-calculator-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 18px;
      }

      .calcb-calculator-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .calcb-calculator-title-row h1 {
        font-size: 1.5rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        margin: 0;
        white-space: normal;
        line-height: 1.2;
      }

      .calcb-subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        max-width: 660px;
      }

      .calcb-subtitle span {
        display: block;
      }

      .calcb-panel {
        border-radius: 14px;
        border: 1px solid rgba(160, 160, 160, 0.55);
        background: var(--bg-panel);
        padding: 16px 16px 18px;
      }

      :root[data-theme="light"] .calcb-panel {
        border-color: rgba(148, 163, 184, 0.7);
      }

      .calcb-panel-title {
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 8px;
      }

      /* Responsive */
      @media (max-width: 600px) and (orientation: portrait) {
        .calcb-calculator-header {
          gap: 4px;
          margin-bottom: 12px;
        }

        .calcb-calculator-title-row h1 {
          font-size: 1.3rem;
        }

        .calcb-panel {
          padding: 12px 10px 14px;
          border-radius: 12px;
        }
      }
    `;

    const container = document.createElement('div');
    container.className = 'calcb-root';

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    container.appendChild(styleEl);

    container.innerHTML += `
      <div class="calcb-calculator-header">
        <div class="calcb-calculator-title-row">
          <h1>Medium Length Name Test</h1>
        </div>
        <p class="calcb-subtitle"><span>Testing sidebar width with four-word title.</span></p>
      </div>
      <div class="calcb-panel">
        <div class="calcb-panel-title">Content</div>
        <p class="calcb-subtitle">This is a dummy calculator module (B).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcB] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcB] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcB] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcB] Setting state:', state);
      }
    };
  }

  window.createCalcB = createCalcB;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcB');
  }
})();