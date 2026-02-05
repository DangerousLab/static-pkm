// Home/nitricCalculator.js
// Nitric Oxide Calculator Module

// Import global MathJax utility
import { loadMathJax, typesetMath } from '../javascript/utilities/mathJax.js';

/**
 * Render the nitric oxide calculator
 * @param {HTMLElement} container - Container element
 * @param {string} instanceId - Unique instance ID
 */
export async function render(container, instanceId) {
  console.log(`[NitricCalculator ${instanceId}] Rendering...`);

  // Load MathJax through global utility (loads once globally)
  try {
    await loadMathJax();
    console.log(`[NitricCalculator ${instanceId}] MathJax ready`);
  } catch (error) {
    console.error(`[NitricCalculator ${instanceId}] Failed to load MathJax:`, error);
    container.innerHTML = '<p>Error: Failed to load math rendering library</p>';
    return;
  }

  // Render calculator UI with LaTeX equations
  container.innerHTML = `
    <div class="nitric-calculator">
      <h2>Nitric Oxide Calculator</h2>
      <div class="calculator-content">
        <p>Chemical equation: \\(2NO + O_2 \\rightarrow 2NO_2\\)</p>

        <!-- ADD YOUR EXISTING CALCULATOR HTML HERE -->
        <!-- Replace this section with your actual calculator interface -->

        <div class="math-example">
          <p>Rate equation: \\(\\frac{d[NO]}{dt} = -k[NO]^2[O_2]\\)</p>
        </div>
      </div>
    </div>
  `;

  // Typeset all math equations in the container
  await typesetMath(container);

  console.log(`[NitricCalculator ${instanceId}] Render complete`);
}

/**
 * Destroy the calculator instance
 * @param {HTMLElement} container - Container element
 * @param {string} instanceId - Unique instance ID
 */
export async function destroy(container, instanceId) {
  console.log(`[NitricCalculator ${instanceId}] Destroying...`);

  // Clean up DOM
  container.innerHTML = '';

  // Note: Don't unload MathJax - it's a global utility that other instances might need

  console.log(`[NitricCalculator ${instanceId}] Destroyed`);
}

/**
 * Get calculator state for persistence
 * @param {string} instanceId - Unique instance ID
 * @returns {Object} State object
 */
export function getState(instanceId) {
  console.log(`[NitricCalculator ${instanceId}] Getting state`);

  // Return your calculator state here
  return {
    // Add your state properties
    // Example: inputValue: document.getElementById('some-input')?.value || ''
  };
}

/**
 * Restore calculator state from persistence
 * @param {Object} state - Saved state object
 * @param {string} instanceId - Unique instance ID
 */
export function setState(state, instanceId) {
  console.log(`[NitricCalculator ${instanceId}] Setting state`, state);

  // Restore your calculator state here
  // Example: 
  // const input = document.getElementById('some-input');
  // if (input && state.inputValue) input.value = state.inputValue;
}
