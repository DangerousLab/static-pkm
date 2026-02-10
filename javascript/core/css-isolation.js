/**
 * CSS Isolation Utilities
 * Handles CSS scoping and containment for module isolation
 */

/**
 * LAYER 3: Style Tag Isolation
 * Find and scope all <style> tags within module root
 */
export function scopeModuleStyles(root, instanceId) {
  const styleTags = root.querySelectorAll('style');
  
  if (styleTags.length === 0) return;
  
  styleTags.forEach((styleTag, index) => {
    try {
      const originalCSS = styleTag.textContent;
      const scopedCSS = scopeCSSToInstance(originalCSS, instanceId);
      styleTag.textContent = scopedCSS;
    } catch (error) {
      console.error(`[CSSIsolation] Failed to scope style tag #${index}:`, error);
    }
  });
  
  console.log(`[CSSIsolation] Scoped ${styleTags.length} style tag(s) for instance ${instanceId}`);
}

/**
 * Scope CSS selectors to a specific instance
 * Transforms: ".my-class { ... }"
 * Into: ".module-boundary[data-instance-id='instanceId'] .my-class { ... }"
 */
export function scopeCSSToInstance(css, instanceId) {
  const scope = `.module-boundary[data-instance-id="${instanceId}"]`;
  
  return css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, (match, selector, separator) => {
    const trimmedSelector = selector.trim();
    
    // Skip @rules (keyframes, media, etc.)
    if (trimmedSelector.startsWith('@')) {
      return match;
    }
    
    // Skip :root pseudo-class
    if (trimmedSelector.startsWith(':root')) {
      return match;
    }
    
    // Prepend scope to selector
    return `${scope} ${trimmedSelector}${separator}`;
  });
}

/**
 * Create isolated module root element
 * Applies isolation classes and attributes
 */
export function createIsolatedRoot(instanceId, isHidden = false) {
  const root = document.createElement('div');
  root.className = 'module-boundary';
  root.dataset.instanceId = instanceId;
  
  if (isHidden) {
    // Hidden root for preloading
    root.style.position = 'absolute';
    root.style.left = '-99999px';
    root.style.top = '-99999px';
    root.style.width = '1px';
    root.style.height = '1px';
    root.style.overflow = 'hidden';
  }
  
  return root;
}
