import type { LayoutGeometry } from '../../types/layout';

let lastApplied: Record<string, string> = {};

export function applyLayoutGeometry(geometry: LayoutGeometry): void {
  // Check if anything has changed
  const keys = Object.keys(geometry.cssVariables);
  let changed = false;

  if (keys.length !== Object.keys(lastApplied).length) {
    changed = true;
  } else {
    for (const key of keys) {
      if (geometry.cssVariables[key] !== lastApplied[key]) {
        changed = true;
        break;
      }
    }
  }

  if (!changed) {
    return;
  }

  // Apply to DOM
  for (const [key, value] of Object.entries(geometry.cssVariables)) {
    document.documentElement.style.setProperty(key, value);
    
    // Also sync state flags to data attributes for easier CSS selection
    if (key === '--layout-is-mobile') {
      document.documentElement.setAttribute('data-layout-is-mobile', value);
    }
    if (key === '--layout-is-landscape') {
      document.documentElement.setAttribute('data-layout-is-landscape', value);
    }
  }

  lastApplied = { ...geometry.cssVariables };
  console.log('INFO cssPropertyBridge: geometry applied', geometry);
}

export function resetBridge(): void {
  lastApplied = {};
}
