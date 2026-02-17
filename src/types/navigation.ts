/**
 * Navigation tree types
 * Matches structure from tree.json
 */

/** Base properties shared by all node types */
interface BaseNode {
  name: string;
  path: string;
}

/** Folder node - contains children */
export interface FolderNode extends BaseNode {
  type: 'folder';
  children: NavigationNode[];
}

/** Module node - user JavaScript module */
export interface ModuleNode extends BaseNode {
  type: 'module';
  id: string;
  title: string;
  file: string;
  tags?: string[];
}

/** Page node - static HTML content */
export interface PageNode extends BaseNode {
  type: 'page';
  id: string;
  title: string;
  file: string;
}

/** Document node - markdown/text */
export interface DocumentNode extends BaseNode {
  type: 'document';
  id: string;
  title: string;
  file: string;
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
