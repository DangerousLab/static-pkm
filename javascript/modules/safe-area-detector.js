/**
 * Detects notch position in landscape mode and applies appropriate CSS class
 */

export function initSafeAreaDetector() {
  /**
   * Wait for layout stabilization using requestAnimationFrame
   * @param {number} frames - Number of frames to wait (1 frame ≈ 16.67ms at 60fps)
   * @returns {Promise<void>}
   */
  function waitForLayout(frames = 1) {
    return new Promise(resolve => {
      let count = 0;
      function tick() {
        count++;
        if (count >= frames) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    });
  }

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
  waitForLayout(12).then(detectNotchPosition);

  // Re-detect on orientation change
  if (window.screen && window.screen.orientation) {
    window.screen.orientation.addEventListener('change', () => {
      console.log('[SafeArea] Screen orientation changed');
      waitForLayout(18).then(detectNotchPosition);
    });
  }

  // Fallback: orientationchange event
  window.addEventListener('orientationchange', () => {
    console.log('[SafeArea] Orientation change event fired');
    waitForLayout(18).then(detectNotchPosition);
  });

  // Backup: resize event
  let resizeAbortController = null;
  window.addEventListener('resize', async () => {
    // Cancel previous resize detection
    if (resizeAbortController) {
      resizeAbortController.abort();
    }
    
    resizeAbortController = new AbortController();
    const signal = resizeAbortController.signal;
    
    try {
      // Wait ~250ms (15 frames at 60fps)
      await Promise.race([
        waitForLayout(15),
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
      ]);
      
      if (!signal.aborted) {
        console.log('[SafeArea] Resize detected, checking orientation');
        detectNotchPosition();
      }
    } catch (err) {
      // Resize was cancelled by newer event
    }
  });
}
