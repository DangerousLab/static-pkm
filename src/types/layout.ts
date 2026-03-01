// Node types matching Unstablon's TipTap schema
export type NodeType =
  | 'paragraph'
  | 'heading'
  | 'codeBlock'
  | 'table'
  | 'image'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'computeEmbed'    // Unstablon-specific: embed calc.js syntax
  | 'horizontalRule'
  | 'mathBlock'       // Unstablon-specific: LaTeX block via MathJax
  | 'frontmatter'

export interface NodeManifest {
  nodeId: string           // stable ID — from SQLite content table
  nodeType: NodeType
  textContent: string      // raw text, markdown syntax stripped
  level?: number           // headings: 1–6
  lineCount?: number       // codeBlock: pre-counted newlines + 1
  rowCount?: number        // table: body rows (not counting header)
  colCount?: number        // table: column count
  imageDimensions?: [number, number]   // [width, height] stored in frontmatter
  fontOverride?: string    // CSS font string if node overrides default
}

export interface HeightCacheEntry {
  nodeId: string
  height: number
  source: 'estimated' | 'oracle' | 'dom'   // dom = highest authority
  timestamp: number                          // unix ms
}

export interface LayoutOracleConfig {
  defaultFont: string        // e.g. 'Inter, system-ui, sans-serif'
  baseFontSize: number       // px (match editor CSS, default 16)
  baseLineHeight: number     // multiplier (default 1.6)
  containerPadding: number   // horizontal padding inside editor container (px)
  codeFont: string           // e.g. 'JetBrains Mono, monospace'
  codeLineHeight: number     // multiplier for code blocks (default 1.5)
  headingScales: [number, number, number, number, number, number]
                             // H1–H6 font-size multipliers (e.g. [2.25,1.875,1.5,1.25,1.125,1])
}

export interface PlatformInfo {
  os: 'windows' | 'macos' | 'linux' | 'ios' | 'android'
  safeAreaInsets: { top: number; right: number; bottom: number; left: number }
  fontScale: number            // OS accessibility scale (1.0 = default)
  devicePixelRatio: number
  isDarkMode: boolean
}

export interface LayoutGeometry {
  headerHeight: number
  sidebarWidth: number         // 0 if collapsed
  sidebarCollapsed: boolean
  editorLeft: number           // starting X coordinate of editor area
  editorWidth: number          // width of the editor/content area
  contentMaxWidth: number      // maximum width of the content area (page-root)
  rightPanelWidth: number      // backlinks/properties panel, 0 if closed
  landscapeLeftBarWidth: number // width of the landscape left bar (mobile landscape)
  isMobile: boolean            // responsive state flag
  isLandscape: boolean         // orientation state flag
  safeTop: number              // headerHeight + OS safe area top
  safeBottom: number           // bottom aesthetic gap + OS safe area bottom
  statusBarHeight: number
  cssVariables: Record<string, string>   // '--layout-*' → 'Npx'
}

export interface UserLayoutPrefs {
  sidebarWidth: number         // user-dragged value, persisted to .state.json
  sidebarCollapsed: boolean
  rightPanelOpen: boolean
  rightPanelWidth: number
}

// Rust IPC response shape — mirrors Rust NodeManifest struct
export interface NodeManifestResponse {
  nodeId: string
  nodeType: string
  textContent: string
  level: number | null
  lineCount: number | null
  rowCount: number | null
  colCount: number | null
  imageDimensions: [number, number] | null
  fontOverride: string | null
}
