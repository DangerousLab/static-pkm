use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Window;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeAreaInsets {
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub left: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub safe_area_insets: SafeAreaInsets,
    pub font_scale: f32,
    pub device_pixel_ratio: f32,
    pub is_dark_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlatformOverrides {
    pub safe_area_insets: Option<SafeAreaInsets>,
    pub device_pixel_ratio: Option<f32>,
}

#[derive(Default)]
pub struct LayoutState {
    pub platform_info_cache: Mutex<Option<PlatformInfo>>,
    pub platform_overrides: Mutex<PlatformOverrides>,
}

#[tauri::command]
pub async fn get_platform_info(
    window: Window,
    state: tauri::State<'_, LayoutState>,
) -> Result<PlatformInfo, String> {
    let overrides_guard = state.platform_overrides.lock().map_err(|e| e.to_string())?;
    
    let os_name = std::env::consts::OS.to_string();
    
    // Default safe areas based on OS
    let mut default_insets = SafeAreaInsets { top: 0.0, right: 0.0, bottom: 0.0, left: 0.0 };
    if os_name == "macos" {
        default_insets.top = 28.0; // Standard macOS titlebar
    } else if os_name == "windows" {
        default_insets.top = 32.0; // Standard Windows titlebar
    }

    let insets = overrides_guard.safe_area_insets.clone().unwrap_or(default_insets);
    let dpr = overrides_guard.device_pixel_ratio.unwrap_or(1.0);
    
    // Get theme from window
    let is_dark_mode = window.theme().map(|t| t == tauri::Theme::Dark).unwrap_or(false);

    let info = PlatformInfo {
        os: os_name,
        safe_area_insets: insets,
        font_scale: 1.0,
        device_pixel_ratio: dpr,
        is_dark_mode,
    };

    Ok(info)
}

#[tauri::command]
pub async fn set_platform_overrides(
    overrides: PlatformOverrides,
    state: tauri::State<'_, LayoutState>,
) -> Result<(), String> {
    let mut overrides_guard = state.platform_overrides.lock().map_err(|e| e.to_string())?;
    
    if overrides.safe_area_insets.is_some() {
        overrides_guard.safe_area_insets = overrides.safe_area_insets;
    }
    if overrides.device_pixel_ratio.is_some() {
        overrides_guard.device_pixel_ratio = overrides.device_pixel_ratio;
    }
    
    let mut cache_guard = state.platform_info_cache.lock().map_err(|e| e.to_string())?;
    *cache_guard = None;

    Ok(())
}
