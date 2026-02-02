/**
 * Detects notch position in landscape mode and applies appropriate CSS class
 */

export function initSafeAreaDetector() {
  function detectNotchPosition() {
    // Only run in landscape mode
    const isLandscape = window.matchMedia('(max-height: 600px) and (orientation: landscape)').matches;
    
    if (!isLandscape) {
      document.documentElement.removeAttribute('data-notch-side');
      console.log('[SafeArea] Not in landscape mode');
      return;
    }

    // Method 1: Use screen.orientation.angle
    // 90 = notch on left, 270/-90 = notch on right
    let angle = 0;
    
    if (window.screen && window.screen.orientation) {
      angle = window.screen.orientation.angle;
    } else if (window.orientation !== undefined) {
      angle = window.orientation;
    }
    
    console.log('[SafeArea] Orientation angle:', angle);
    
    // Determine notch side based on angle
    // Most devices: 90° = rotated left (notch on left), -90°/270° = rotated right (notch on right)
    if (angle === 90) {
      document.documentElement.setAttribute('data-notch-side', 'left');
      console.log('[SafeArea] Angle 90° - Notch on LEFT');
    } else if (angle === -90 || angle === 270) {
      document.documentElement.setAttribute('data-notch-side', 'right');
      console.log('[SafeArea] Angle -90°/270° - Notch on RIGHT');
    } else {
      // Fallback: Try measuring safe areas
      console.log('[SafeArea] Unknown angle, measuring safe areas...');
      measureSafeAreas();
    }
  }

  function measureSafeAreas() {
    // Use getComputedStyle on root element with CSS variables
    const root = document.documentElement;
    
    // Set CSS custom properties to read env() values
    root.style.setProperty('--test-safe-left', 'env(safe-area-inset-left, 0px)');
    root.style.setProperty('--test-safe-right', 'env(safe-area-inset-right, 0px)');
    
    const computedStyle = getComputedStyle(root);
    const leftValue = computedStyle.getPropertyValue('--test-safe-left').trim();
    const rightValue = computedStyle.getPropertyValue('--test-safe-right').trim();
    
    console.log('[SafeArea] Computed left:', leftValue, 'right:', rightValue);
    
    // Parse pixel values
    const leftPx = parseFloat(leftValue) || 0;
    const rightPx = parseFloat(rightValue) || 0;
    
    console.log('[SafeArea] Parsed left:', leftPx, 'right:', rightPx);
    
    if (leftPx > 20) {
      document.documentElement.setAttribute('data-notch-side', 'left');
      console.log('[SafeArea] Measured - Notch on LEFT');
    } else if (rightPx > 20) {
      document.documentElement.setAttribute('data-notch-side', 'right');
      console.log('[SafeArea] Measured - Notch on RIGHT');
    } else {
      document.documentElement.setAttribute('data-notch-side', 'none');
      console.log('[SafeArea] Measured - No notch detected');
    }
    
    // Clean up
    root.style.removeProperty('--test-safe-left');
    root.style.removeProperty('--test-safe-right');
  }

  // Initial detection
  setTimeout(detectNotchPosition, 200);

  // Re-detect on orientation change
  if (window.screen && window.screen.orientation) {
    window.screen.orientation.addEventListener('change', () => {
      console.log('[SafeArea] Screen orientation changed');
      setTimeout(detectNotchPosition, 300);
    });
  }

  // Fallback: orientationchange event
  window.addEventListener('orientationchange', () => {
    console.log('[SafeArea] Orientation change event fired');
    setTimeout(detectNotchPosition, 300);
  });

  // Backup: resize event
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      console.log('[SafeArea] Resize detected, checking orientation');
      detectNotchPosition();
    }, 250);
  });
}