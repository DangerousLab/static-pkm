// nitricCalculator.js
(function (global) {
  function createNitricCalculator(options) {
    const root = options.root;
    if (!root) throw new Error('Nitric calculator requires a root element.');

    // Removed the extra outer ".card" box so the host page can wrap this
    // calculator in its own card/panel container. This avoids double boxes
    // and makes alignment consistent when multiple calculators are placed
    // inside a shared layout.
    root.innerHTML = `
      <header class="content-header">
        <div class="content-title-row">
          <h1>Nitric Acid Stoichiometry Calculator</h1>
        </div>
        <div class="reaction-row">
          <div class="reaction-wrapper" id="reactionWrapper-nitric">
            <span class="pill">
              <span class="pill-inner" id="pillText-nitric">KNO₃ + H₂SO₄ → HNO₃ + KHSO₄</span>
            </span>
          </div>
        </div>
        <p class="subtitle">
          <span>Stoichiometric calculator for HNO₃ from KNO₃ and aqueous H₂SO₄ at 25 °C.</span>
          <span>Reaction defaults to 1 mol KNO₃ and 1 mol H₂SO₄ and can be scaled with a factor.</span>
        </p>
      </header>

      <div class="layout">
        <section class="panel">
          <div class="panel-title">Inputs & results</div>
          <div class="two-cols">
            <div class="subpanel">
              <div class="subpanel-title">Inputs</div>

              <div class="form-row">
                <label for="scaleFactor-nitric">Scale factor (mol of KNO₃ and H₂SO₄)</label>
                <input id="scaleFactor-nitric" class="field" type="number" step="0.1" value="4" min="0" />
                <div class="hint" id="scaleWarning-nitric" style="display:none;">
                  Scale factor must be ≥ 0. Negative values are not allowed.
                </div>
              </div>

              <div class="form-row">
                <label for="targetConc-nitric">Target nitric acid concentration (w/w)</label>
                <select id="targetConc-nitric" class="field">
                  <option value="0.550">55%</option>
                  <option value="0.680">68%</option>
                  <option value="0.760" selected>76%</option>
                  <option value="0.900">90%</option>
                  <option value="1.000">100%</option>
                </select>
              </div>

              <div class="form-row">
                <!-- FIX: render p as LaTeX -->
                <label for="acidPercent-nitric">Sulfuric acid concentration, \\(p\\) (% w/w H₂SO₄)</label>
                <input id="acidPercent-nitric" class="field" type="number" step="0.1" value="93"
                       placeholder="e.g. 93" />
              </div>
            </div>

            <div class="subpanel">
              <div class="subpanel-title">Results</div>

              <div class="form-row">
                <label for="acidDensity-nitric">Density of H₂SO₄ solution (25 °C) (g/mL)</label>
                <input id="acidDensity-nitric" class="field" type="number" readonly placeholder="computed" />
              </div>

              <div class="form-row">
                <!-- FIX: render M_acid as LaTeX -->
                <label for="acidMass-nitric">Mass of sulfuric acid solution, \\(M_{\\mathrm{acid}}\\) (g)</label>
                <input id="acidMass-nitric" class="field" type="number" readonly placeholder="computed" />
              </div>

              <div class="form-row">
                <label for="acidVolume-nitric">Volume of sulfuric acid solution (mL)</label>
                <input id="acidVolume-nitric" class="field" type="number" readonly placeholder="computed" />
              </div>

              <div class="form-row">
                <label for="waterInAcid-nitric">Water already in acid, \\(m_{\\mathrm{H_2O,acid}}\\) (g)</label>
                <input id="waterInAcid-nitric" class="field" type="number" readonly placeholder="computed" />
              </div>

              <div class="form-row">
                <label for="waterMass-nitric">Required added water, \\(M_{\\mathrm{add}}\\) (g)</label>
                <input id="waterMass-nitric" class="field" type="number" readonly placeholder="computed" />
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">Equations</div>

          <div class="math-block"><div class="math-inner" id="equationInfo-nitric"></div></div>
          <div class="math-block"><div class="math-inner" id="waterInfo-nitric"></div></div>
        </section>
      </div>
    `;

    const M_HNO3 = 63.0;
    const M_H2SO4 = 98.0;
    const M_KNO3 = 101.1;

    const targetConcEl = root.querySelector('#targetConc-nitric');
    const acidPercentEl = root.querySelector('#acidPercent-nitric');
    const scaleFactorEl = root.querySelector('#scaleFactor-nitric');
    const scaleWarningEl = root.querySelector('#scaleWarning-nitric');

    const acidDensityEl = root.querySelector('#acidDensity-nitric');
    const acidMassEl = root.querySelector('#acidMass-nitric');
    const acidVolumeEl = root.querySelector('#acidVolume-nitric');
    const waterInAcidEl = root.querySelector('#waterInAcid-nitric');
    const waterMassEl = root.querySelector('#waterMass-nitric');

    const eqInfoEl = root.querySelector('#equationInfo-nitric');
    const waterInfoEl = root.querySelector('#waterInfo-nitric');

    const densityListH2SO4 = [
      1.00380, 1.01040, 1.01690, 1.02340, 1.03000, 1.03670, 1.04340, 1.05020, 1.05710, 1.06400,
      1.07100, 1.07800, 1.08510, 1.09220, 1.09940, 1.10670, 1.11410, 1.12150, 1.12900, 1.13650,
      1.14410, 1.15170, 1.15940, 1.16720, 1.17500, 1.18290, 1.19090, 1.19890, 1.20690, 1.21500,
      1.22320, 1.23140, 1.23960, 1.24790, 1.25630, 1.26470, 1.27320, 1.28180, 1.29040, 1.29910,
      1.30790, 1.31670, 1.32560, 1.33460, 1.34370, 1.35300, 1.36240, 1.37190, 1.38140, 1.39110,
      1.40090, 1.41090, 1.42090, 1.43100, 1.44120, 1.45160, 1.46210, 1.47260, 1.48320, 1.49400,
      1.50480, 1.51570, 1.52670, 1.53780, 1.54900, 1.56020, 1.57150, 1.58290, 1.59440, 1.60590,
      1.61750, 1.62920, 1.64090, 1.65260, 1.66440, 1.67610, 1.68780, 1.69940, 1.71080, 1.72210,
      1.73310, 1.74370, 1.75400, 1.76390, 1.77320, 1.78180, 1.78970, 1.79680, 1.80330, 1.80910,
      1.81420, 1.81880, 1.82270, 1.82600, 1.82860, 1.83050, 1.83140, 1.83100, 1.82920, 1.82550
    ];

    const densityListHNO3 = [
      1.00241, 1.00778, 1.01318, 1.01861, 1.02408, 1.02958, 1.03520, 1.04090, 1.04660, 1.05230,
      1.05810, 1.06400, 1.06990, 1.07580, 1.08180, 1.08790, 1.09400, 1.10010, 1.10620, 1.11230,
      1.11850, 1.12470, 1.13100, 1.13740, 1.14380, 1.15020, 1.15660, 1.16310, 1.16970, 1.17630,
      1.18290, 1.18960, 1.19630, 1.20300, 1.20980, 1.21630, 1.22270, 1.22910, 1.23540, 1.24170,
      1.24800, 1.25430, 1.26060, 1.26690, 1.27320, 1.27950, 1.28580, 1.29210, 1.29840, 1.30430,
      1.31020, 1.31600, 1.32180, 1.32750, 1.33310, 1.33860, 1.34410, 1.34950, 1.35480, 1.36000,
      1.36510, 1.37000, 1.37480, 1.37950, 1.38410, 1.38870, 1.39320, 1.39760, 1.40190, 1.40610,
      1.41020, 1.41420, 1.41820, 1.42210, 1.42590, 1.42960, 1.43330, 1.43690, 1.44040, 1.44390,
      1.44730, 1.45070, 1.45400, 1.45720, 1.46030, 1.46330, 1.46620, 1.46900, 1.47160, 1.47410,
      1.47660, 1.47890, 1.48070, 1.48260, 1.48460, 1.48670, 1.48890, 1.49220, 1.49690, 1.50400
    ];

    function parseInput(el) {
      const v = parseFloat(el.value);
      return isNaN(v) ? 0 : v;
    }

    function getDensityFromTable(list, percent) {
      let pct = Math.round(percent);
      if (pct < 1) pct = 1;
      if (pct > 100) pct = 100;
      return list[pct - 1];
    }

    function scaleMathBlocks() {
      const blocks = root.querySelectorAll('.math-block');
      blocks.forEach(block => {
        const inner = block.querySelector('.math-inner');
        if (!inner) return;
        const mjx = inner.querySelector('mjx-container');
        if (!mjx) return;

        inner.style.transform = 'scale(1)';
        const blockWidth = block.clientWidth - 12;
        const contentWidth = mjx.getBoundingClientRect().width;
        if (blockWidth <= 0 || contentWidth <= 0) return;

        const scale = Math.min(1, blockWidth / contentWidth);
        inner.style.transform = 'scale(' + scale + ')';
      });
    }

    function scaleReactionComponent() {
      const row = root.querySelector('.reaction-row');
      const wrapper = root.querySelector('#reactionWrapper-nitric');
      if (!row || !wrapper) return;

      wrapper.style.transform = 'scale(1)';

      const available = row.clientWidth;
      const needed = wrapper.getBoundingClientRect().width;
      if (available <= 0 || needed <= 0) return;

      const scale = Math.min(1, available / needed);
      wrapper.style.transform = 'scale(' + scale + ')';
    }

    function rescaleAll() {
      scaleMathBlocks();
      scaleReactionComponent();
    }

    function updateCalculator() {
      const w = parseFloat(targetConcEl.value);
      const p = parseInput(acidPercentEl);
      const scale = parseInput(scaleFactorEl);

      scaleWarningEl.style.display = 'none';

      // Track if any error/warning is active to color the summary text red.
      let hasErrorOrWarning = false;

      if (!scale || scale < 0) {
        hasErrorOrWarning = true;
        eqInfoEl.innerHTML =
          '<span style="color:var(--danger); font-weight:600;">Scale factor must be ≥ 0. Negative values are not allowed.</span>';
        waterInfoEl.innerHTML = '';
        acidDensityEl.value = '';
        acidMassEl.value = '';
        acidVolumeEl.value = '';
        waterInAcidEl.value = '';
        waterMassEl.value = '';
        if (window.MathJax && window.MathJax.typesetPromise) {
          MathJax.typesetPromise().then(rescaleAll);
        } else {
          rescaleAll();
        }
        return;
      }

      if (p <= 0 || p > 100) {
        hasErrorOrWarning = true;
        eqInfoEl.innerHTML =
          '<span style="color:var(--danger); font-weight:600;">Error: Acid concentration must be &gt;0% and ≤100%.</span>';
        waterInfoEl.innerHTML = '';
        acidDensityEl.value = '';
        acidMassEl.value = '';
        acidVolumeEl.value = '';
        waterInAcidEl.value = '';
        waterMassEl.value = '';
        if (window.MathJax && window.MathJax.typesetPromise) {
          MathJax.typesetPromise().then(rescaleAll);
        } else {
          rescaleAll();
        }
        return;
      }

      const n_HNO3 = scale;
      const mHNO3 = n_HNO3 * M_HNO3;

      const n_H2SO4 = scale;
      const mH2SO4_pure = n_H2SO4 * M_H2SO4;

      const n_KNO3 = n_HNO3;
      const mKNO3 = n_KNO3 * M_KNO3;

      const rhoH2SO4 = getDensityFromTable(densityListH2SO4, p);
      acidDensityEl.value = Number(rhoH2SO4.toPrecision(5));

      const M_acid = mH2SO4_pure / (p / 100);
      acidMassEl.value = M_acid.toFixed(1);
      const V_acid = M_acid / rhoH2SO4;
      acidVolumeEl.value = V_acid.toFixed(1);

      const mH2O_acid = M_acid * (1 - p / 100);
      waterInAcidEl.value = mH2O_acid.toFixed(1);

      const mH2O_total = mHNO3 * (1 - w) / w;
      const M_add = mH2O_total - mH2O_acid;
      waterMassEl.value = M_add.toFixed(1);

      let warningText = '';
      if (M_add < 0) {
        hasErrorOrWarning = true;
        warningText =
          'Water added would be negative.<br/>' +
          'Acid already has more water than this target allows.';
      }

      const block1 = `
        \\[
          n_{\\mathrm{HNO_3}} = ${n_HNO3.toFixed(2)}\\,\\text{mol},\\quad
          n_{\\mathrm{H_2SO_4}} = ${n_H2SO4.toFixed(2)}\\,\\text{mol}
        \\]
      `;
      const block2 = `
        \\[
          p = ${p.toFixed(2)}\\,\\%,\\quad
          w = ${(w * 100).toFixed(1)}\\,\\%
        \\]
      `;
      const block3 = `
        \\[
          M_{\\mathrm{acid}}(p) = \\dfrac{m_{\\mathrm{H_2SO_4,pure}}}{p/100}
            = ${M_acid.toFixed(1)}\\,\\text{g}
        \\]
      `;
      const block4 = `
        \\[
          m_{\\mathrm{H_2O,acid}}(p)
            = M_{\\mathrm{acid}}(p)\\,\\bigl(1 - \\tfrac{p}{100}\\bigr)
            = ${mH2O_acid.toFixed(1)}\\,\\text{g}
        \\]
      `;
      const block5 = `
        \\[
          m_{\\mathrm{H_2O,total}}(w)
            = m_{\\mathrm{HNO_3}}\\,\\dfrac{1 - w}{w}
            = ${mH2O_total.toFixed(1)}\\,\\text{g}
        \\]
      `;
      const block6 = `
        \\[
          M_{\\mathrm{add}}(w,p)
            = m_{\\mathrm{H_2O,total}} - m_{\\mathrm{H_2O,acid}}
            = \\mathbf{${M_add.toFixed(1)}\\,\\text{g}}
        \\]
      `;

      eqInfoEl.innerHTML =
        block1 + block2 + block3 + block4 + block5 + block6 +
        (warningText
          ? `<div style="margin-top:4px; white-space:normal; line-height:1.3; color:var(--danger); font-weight:600;">${warningText}</div>`
          : '');

      const targetPct = w * 100;
      const rhoHNO3 = getDensityFromTable(densityListHNO3, targetPct);
      const totalSolutionMass = mHNO3 + mH2O_total;
      const V_HNO3 = totalSolutionMass / rhoHNO3;

      // Decide color for the summary values: green when OK, red when any error/warning.
      const summaryColor = hasErrorOrWarning ? 'var(--danger)' : 'var(--success)';

      waterInfoEl.innerHTML =
        `Add potassium nitrate: <span style="color:${summaryColor}; font-weight:600;">${mKNO3.toFixed(1)} g</span><br/>` +
        `Add ${p.toFixed(1)}% sulfuric acid: <span style="color:${summaryColor}; font-weight:600;">${V_acid.toFixed(1)} mL</span><br/>` +
        `Add water: <span style="color:${summaryColor}; font-weight:600;">${M_add.toFixed(1)} mL</span>` +
        `<br/><br/>` +
        `Maximum yield of ${(w * 100).toFixed(1)}% nitric acid: <span style="font-weight:600;">${V_HNO3.toFixed(1)} mL</span><br/>` +
        `Density of ${(w * 100).toFixed(1)}% nitric acid at 25°C: <span style="font-weight:600;">${rhoHNO3.toPrecision(5)} g/mL</span>`;

      if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise().then(rescaleAll);
      } else {
        rescaleAll();
      }
    }

    function initEvents() {
      targetConcEl.addEventListener('input', updateCalculator);
      targetConcEl.addEventListener('change', updateCalculator);
      acidPercentEl.addEventListener('input', updateCalculator);
      acidPercentEl.addEventListener('change', updateCalculator);
      scaleFactorEl.addEventListener('input', updateCalculator);
      scaleFactorEl.addEventListener('change', updateCalculator);

      window.addEventListener('resize', rescaleAll);
      window.addEventListener('load', rescaleAll);
    }

    initEvents();
    updateCalculator();

    return {
      update: updateCalculator,
      rescale: rescaleAll
    };
  }

  global.createNitricCalculator = createNitricCalculator;
  if (window.__moduleReady) {
    window.__moduleReady('createNitricCalculator');
  }
})(window);