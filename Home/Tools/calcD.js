(function () {
  function createCalcD(options) {
    const root = options.root;

    console.log('[CalcD] Initializing');

    // ==================== INLINE STYLES ====================
    const styles = `
      .calcd-calculator-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 18px;
      }

      .calcd-calculator-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .calcd-calculator-title-row h1 {
        font-size: 1.5rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        margin: 0;
        white-space: normal;
        line-height: 1.2;
      }

      .calcd-subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        max-width: 660px;
      }

      .calcd-subtitle span {
        display: block;
      }

      .calcd-panel {
        border-radius: 14px;
        border: 1px solid rgba(160, 160, 160, 0.55);
        background: var(--bg-panel);
        padding: 16px 16px 18px;
      }

      :root[data-theme="light"] .calcd-panel {
        border-color: rgba(148, 163, 184, 0.7);
      }

      .calcd-panel-title {
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 8px;
      }

      /* Responsive */
      @media (max-width: 600px) and (orientation: portrait) {
        .calcd-calculator-header {
          gap: 4px;
          margin-bottom: 12px;
        }

        .calcd-calculator-title-row h1 {
          font-size: 1.3rem;
        }

        .calcd-panel {
          padding: 12px 10px 14px;
          border-radius: 12px;
        }
      }
    `;

    const container = document.createElement('div');
    container.className = 'calcd-root';

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    container.appendChild(styleEl);

    container.innerHTML += `
      <div class="calcd-calculator-header">
        <div class="calcd-calculator-title-row">
          <h1>Really Quite Long Sidebar Title Example</h1>
        </div>
        <p class="calcd-subtitle"><span>Six-word title, likely to overflow base width.</span></p>
      </div>
      <div class="calcd-panel">
        <div class="calcd-panel-title">Content</div>
        <p class="calcd-subtitle">This is a dummy calculator module (D).</p>
      </div>
    `;

    root.appendChild(container);

    console.log('[CalcD] Initialized successfully');

    return {
      destroy() {
        console.log('[CalcD] Destroying');
        root.innerHTML = "";
      },
      getState() {
        console.log('[CalcD] Getting state');
        return {};
      },
      setState(state) {
        console.log('[CalcD] Setting state:', state);
      }
    };
  }

  window.createCalcD = createCalcD;
  if (window.__moduleReady) {
    window.__moduleReady('createCalcD');
  }
})();