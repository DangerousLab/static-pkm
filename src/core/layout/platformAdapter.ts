import { invoke } from '@tauri-apps/api/core';
import type { PlatformInfo } from '../../types/layout';

let cachedPlatformInfo: PlatformInfo | null = null;

export async function getPlatformInfo(): Promise<PlatformInfo> {
  if (cachedPlatformInfo !== null) {
    return cachedPlatformInfo;
  }

  try {
    const info = await invoke<PlatformInfo>('get_platform_info');
    cachedPlatformInfo = info;
    return info;
  } catch (error) {
    throw new Error(`LayoutEngine: Failed to get platform info - ${error}`);
  }
}

export async function setPlatformOverrides(
  overrides: Partial<{ safeAreaInsets: PlatformInfo['safeAreaInsets']; devicePixelRatio: number }>
): Promise<void> {
  try {
    await invoke<void>('set_platform_overrides', { overrides });
    cachedPlatformInfo = null; // Invalidate cache so next getPlatformInfo re-fetches
  } catch (error) {
    throw new Error(`LayoutEngine: Failed to set platform overrides - ${error}`);
  }
}

export function getCachedPlatformInfo(): PlatformInfo | null {
  return cachedPlatformInfo;
}
