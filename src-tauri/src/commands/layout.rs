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

// ── Phase 2: Layout Oracle Commands ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeManifest {
    pub node_id: String,
    pub node_type: String,
    pub text_content: String,
    pub level: Option<u8>,
    pub line_count: Option<u32>,
    pub row_count: Option<u32>,
    pub col_count: Option<u32>,
    pub image_dimensions: Option<(u32, u32)>,
    pub font_override: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeightCacheEntry {
    pub node_id: String,
    pub height: f64,
    pub source: String,
    pub timestamp: u64,
}

#[tauri::command]
pub async fn get_node_manifest(
    note_id: String,
    db_state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<NodeManifest>, String> {
    let db = &db_state.0;
    db.execute(|conn| {
        let mut stmt = conn.prepare(
            "SELECT node_id, node_type, text_content, level, line_count, row_count, col_count, img_width, img_height, font_override 
             FROM node_manifest 
             WHERE note_id = ?1 
             ORDER BY position ASC"
        )?;

        let rows = stmt.query_map(rusqlite::params![note_id], |row| {
            let img_width: Option<u32> = row.get(7)?;
            let img_height: Option<u32> = row.get(8)?;
            let image_dimensions = match (img_width, img_height) {
                (Some(w), Some(h)) => Some((w, h)),
                _ => None,
            };

            Ok(NodeManifest {
                node_id: row.get(0)?,
                node_type: row.get(1)?,
                text_content: row.get(2)?,
                level: row.get(3)?,
                line_count: row.get(4)?,
                row_count: row.get(5)?,
                col_count: row.get(6)?,
                image_dimensions,
                font_override: row.get(9)?,
            })
        })?;

        let mut manifests = Vec::new();
        for row in rows {
            manifests.push(row.map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?);
        }
        Ok(manifests)
    })
}

#[tauri::command]
pub async fn set_node_manifest(
    note_id: String,
    manifest: Vec<NodeManifest>,
    db_state: tauri::State<'_, crate::db::DbState>,
) -> Result<(), String> {
    let db = &db_state.0;
    db.execute_mut(|conn| {
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM node_manifest WHERE note_id = ?1", rusqlite::params![note_id])?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO node_manifest (
                    note_id, node_id, node_type, text_content, level, line_count, 
                    row_count, col_count, img_width, img_height, font_override, position
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
            )?;

            for (i, node) in manifest.iter().enumerate() {
                let img_width = node.image_dimensions.map(|d| d.0);
                let img_height = node.image_dimensions.map(|d| d.1);
                
                stmt.execute(rusqlite::params![
                    note_id,
                    node.node_id,
                    node.node_type,
                    node.text_content,
                    node.level,
                    node.line_count,
                    node.row_count,
                    node.col_count,
                    img_width,
                    img_height,
                    node.font_override,
                    i as i64
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    })
}

#[tauri::command]
pub async fn get_height_cache(
    note_id: String,
    db_state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<HeightCacheEntry>, String> {
    let db = &db_state.0;
    db.execute(|conn| {
        let mut stmt = conn.prepare(
            "SELECT hc.node_id, hc.height, hc.source, hc.timestamp 
             FROM height_cache hc
             INNER JOIN node_manifest nm ON nm.node_id = hc.node_id
             WHERE nm.note_id = ?1"
        )?;

        let rows = stmt.query_map(rusqlite::params![note_id], |row| {
            Ok(HeightCacheEntry {
                node_id: row.get(0)?,
                height: row.get(1)?,
                source: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row.map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?);
        }
        Ok(entries)
    })
}

#[tauri::command]
pub async fn update_height_cache(
    entries: Vec<HeightCacheEntry>,
    db_state: tauri::State<'_, crate::db::DbState>,
) -> Result<(), String> {
    let db = &db_state.0;
    db.execute_mut(|conn| {
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO height_cache (node_id, height, source, timestamp)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(node_id) DO UPDATE SET
                 height = excluded.height,
                 source = excluded.source,
                 timestamp = excluded.timestamp
                 WHERE height_cache.source != 'dom' OR excluded.source = 'dom'"
            )?;

            for entry in entries {
                stmt.execute(rusqlite::params![
                    entry.node_id,
                    entry.height,
                    entry.source,
                    entry.timestamp as i64
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    })
}
