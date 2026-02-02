(function () {
  function createCalcA(options) {
    const root = options.root;

    console.log('[CalcA] Initializing');

    // ==================== INLINE STYLES ====================
    const styles = `
      .calca-calculator-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 18px;
      }

      .calca-calculator-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .calca-calculator-title-row h1 {
        font-size: 1.5rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        margin: 0;
        white-space: normal;
        line-height: 1.2;
      }

      .calca-subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        max-width: 660px;
      }

      .calca-subtitle span {
        display: block;
      }

      .calca-panel {
        border-radius: 14px;
        border: 1px solid rgba(160, 160, 160, 0.55);
        background: var(--bg-panel);
        padding: 16px 16px 18px;
      }

      :root[data-theme="light"] .calca-panel {
        border-color: rgba(148, 163, 184, 0.7);
      }

      .calca-panel-title {
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 8px;
      }

      /* Responsive */
      @media (max-width: 600px) and (orientation: portrait) {
        .calca-calculator-header {
          gap: 4px;
          margin-bottom: 12px;
        }

        .calca-calculator-title-row h1 {
          font-size: 1.3rem;
        }

        .calca-panel {
          padding: 12px 10px 14px;
          border-radius: 12px;
        }
      }
    `;

    const container = document.createElement('div');
    container.className = 'calca-root';

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    container.appendChild(styleEl);

    container.innerHTML += `
      <div class="calca-calculator-header">
        <div class="calca-calculator-title-row">
          <h1>Short Test One</h1>
        </div>
        <p class="calca-subtitle"><span>Simple placeholder calculator for layout testing.</span></p>
      </div>
      <div class="calca-panel">
        <div class="calca-panel-title">Content</div>
        <p class="calca-subtitle">This is a dummy calculator module (A).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcA] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcA] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcA] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcA] Setting state:', state);
      }
    };
  }

  window.createCalcA = createCalcA;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcA');
  }
})();