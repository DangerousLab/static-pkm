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
  noteId: string
  nodeId: string
  height: number
  source: 'estimated' | 'dictator' | 'dom'   // dom = highest authority
  timestamp: number                          // unix ms
}

export interface BlockTypography {
  fontSize: number;      // px
  lineHeight: number;    // px
  marginTop: number;     // px
  marginBottom: number;  // px
  paddingTop?: number;   // px
  paddingBottom?: number;// px
  borderWidth?: number;  // px
}

export interface LayoutDictatorConfig {
  defaultFont: string;       // e.g. 'system-ui, sans-serif'
  codeFont: string;          // e.g. 'monospace'
  containerPadding: number;  // horizontal padding inside editor container (px)
  
  // Exact pixel dimensions for every block type
  paragraph: BlockTypography;
  heading1: BlockTypography;
  heading2: BlockTypography;
  heading3: BlockTypography;
  heading4: BlockTypography;
  heading5: BlockTypography;
  heading6: BlockTypography;
  codeBlock: BlockTypography;
  blockquote: BlockTypography;
  list: BlockTypography;
  table: { rowHeight: number; margins: number };
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
