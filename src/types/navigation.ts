/**
 * Navigation tree types
 * Matches structure from tree.json
 */

/** Folder node - contains children */
export interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: NavigationNode[];
}

/** Module node - user JavaScript module */
export interface ModuleNode {
  type: 'module';
  id: string;
  title: string;
  file: string;
  path?: string;
  name?: string;
  tags?: string[];
}

/** Page node - static HTML content */
export interface PageNode {
  type: 'page';
  id: string;
  title: string;
  file: string;
  path?: string;
  name?: string;
}

/** Document node - markdown/text */
export interface DocumentNode {
  type: 'document';
  id: string;
  title: string;
  file: string;
  path?: string;
  name?: string;
}

/** Union type for all navigation node types */
export type NavigationNode = FolderNode | ModuleNode | PageNode | DocumentNode;

/** Type guard for folder nodes */
export function isFolderNode(node: NavigationNode): node is FolderNode {
  return node.type === 'folder';
}

/** Type guard for module nodes */
export function isModuleNode(node: NavigationNode): node is ModuleNode {
  return node.type === 'module';
}

/** Type guard for page nodes */
export function isPageNode(node: NavigationNode): node is PageNode {
  return node.type === 'page';
}

/** Type guard for document nodes */
export function isDocumentNode(node: NavigationNode): node is DocumentNode {
  return node.type === 'document';
}

/** Content node union (anything that can be opened) */
export type ContentNode = ModuleNode | PageNode | DocumentNode;

/** Type guard for content nodes (non-folder) */
export function isContentNode(node: NavigationNode): node is ContentNode {
  return node.type !== 'folder';
}

/**
 * Get display name for any navigation node
 */
export function getNodeDisplayName(node: NavigationNode): string {
  if (isFolderNode(node)) {
    return node.name;
  }
  // For content nodes, use title (this is the displayName from the module)
  return node.title;
}

/**
 * Get unique identifier for any navigation node
 */
export function getNodeId(node: NavigationNode): string {
  if (isFolderNode(node)) {
    return node.path;
  }
  return node.id;
}
