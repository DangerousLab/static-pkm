(function () {
  function createCalcE(options) {
    const root = options.root;

    console.log('[CalcE] Initializing');

    // ==================== INLINE STYLES ====================
    const styles = `
      .calce-calculator-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 18px;
      }

      .calce-calculator-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .calce-calculator-title-row h1 {
        font-size: 1.5rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        margin: 0;
        white-space: normal;
        line-height: 1.2;
      }

      .calce-subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        max-width: 660px;
      }

      .calce-subtitle span {
        display: block;
      }

      .calce-panel {
        border-radius: 14px;
        border: 1px solid rgba(160, 160, 160, 0.55);
        background: var(--bg-panel);
        padding: 16px 16px 18px;
      }

      :root[data-theme="light"] .calce-panel {
        border-color: rgba(148, 163, 184, 0.7);
      }

      .calce-panel-title {
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 8px;
      }

      /* Responsive */
      @media (max-width: 600px) and (orientation: portrait) {
        .calce-calculator-header {
          gap: 4px;
          margin-bottom: 12px;
        }

        .calce-calculator-title-row h1 {
          font-size: 1.3rem;
        }

        .calce-panel {
          padding: 12px 10px 14px;
          border-radius: 12px;
        }
      }
    `;

    const container = document.createElement('div');
    container.className = 'calce-root';

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    container.appendChild(styleEl);

    container.innerHTML += `
      <div class="calce-calculator-header">
        <div class="calce-calculator-title-row">
          <h1>Extremely Long Sidebar Calculator Title For Layout Testing</h1>
        </div>
        <p class="calce-subtitle"><span>Eight-word title to force maximum hover expansion.</span></p>
      </div>
      <div class="calce-panel">
        <div class="calce-panel-title">Content</div>
        <p class="calce-subtitle">This is a dummy calculator module (E).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcE] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcE] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcE] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcE] Setting state:', state);
      }
    };
  }

  window.createCalcE = createCalcE;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcE');
  }
})();