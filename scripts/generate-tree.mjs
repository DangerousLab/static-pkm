import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root content directory and output JSON path
const homeDir = path.join(__dirname, "..", "Home");
const outDir = path.join(__dirname, "..", "javascript");
const outFile = path.join(outDir, "tree.json");

// ---------- Helpers for type / id ----------

// Determine node type based on file extension
function extToType(ext) {
  switch (ext.toLowerCase()) {
    case ".js":
      return "module"; // JS calculator/module
    case ".html":
      return "page"; // Static HTML page
    case ".md":
      return "document"; // Markdown document
    default:
      return null; // Ignore other types
  }
}

// Derive id from filename (without extension)
function filenameToId(filename) {
  const base = filename.replace(/\.[^/.]+$/, ""); // strip extension
  return base;
}

// Fallback title from filename
function filenameToTitle(filename) {
  const base = filename.replace(/\.[^/.]+$/, "");
  const withSpaces = base.replace(/[-_]+/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

// ---------- Helpers for title extraction ----------

// Extract first <h1>...</h1> from a string
function extractH1FromHtmlLike(content) {
  const match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return null;
  const inner = match[1].replace(/\s+/g, " ").trim();
  return inner || null;
}

// Extract first markdown heading (# ...)
function extractTitleFromMarkdown(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#{1,6}\s+(.*)$/);
    if (m && m[1].trim()) {
      return m[1].trim();
    }
  }
  return null;
}

// Get title based on type and file contents
function extractTitleForFile(type, filename, content) {
  if (type === "module" || type === "page") {
    // For JS and HTML, try <h1>...</h1>
    const fromH1 = extractH1FromHtmlLike(content);
    if (fromH1) return fromH1;
  } else if (type === "document") {
    // For MD, try first markdown heading
    const fromMd = extractTitleFromMarkdown(content);
    if (fromMd) return fromMd;
  }
  // Fallback: filename-based
  return filenameToTitle(filename);
}

// ---------- Helpers for tags extraction ----------

// Parse a comma-separated tags list into ['tag1', 'tag2', ...]
function parseTagsList(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// Extract tags from JS: look for "// @tags: tag1, tag2"
function extractTagsFromJs(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*\/\/\s*@tags:\s*(.+)$/i);
    if (m && m[1]) {
      return parseTagsList(m[1]);
    }
  }
  return [];
}

// Extract tags from HTML: look for "<!-- @tags: tag1, tag2 -->"
function extractTagsFromHtml(content) {
  const re = /<!--\s*@tags:\s*([^>]+?)-->/i;
  const m = content.match(re);
  if (m && m[1]) {
    return parseTagsList(m[1]);
  }
  return [];
}

// Extract tags from MD: markdown-style comment like "[//]: # (@tags: tag1, tag2)"
function extractTagsFromMd(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    // Match `[//]: # (@tags: tag1, tag2)`
    const m = line.match(/^\s*\[\/\/\]:\s*#\s*\(@tags:\s*(.+)\s*\)\s*$/i);
    if (m && m[1]) {
      return parseTagsList(m[1]);
    }
  }
  return [];
}

// Extract tags based on type
function extractTagsForFile(type, content) {
  if (type === "module") return extractTagsFromJs(content);
  if (type === "page") return extractTagsFromHtml(content);
  if (type === "document") return extractTagsFromMd(content);
  return [];
}

// ---------- Core tree builder ----------

/**
 * Recursively build a tree node for a directory.
 * @param {string} dirPath - absolute path to current directory
 * @param {string} relativePath - logical path from "Home", e.g. "Home", "Home/Tools"
 * @returns {object} folder node
 */
function buildFolderNode(dirPath, relativePath) {
  const name = path.basename(relativePath); // e.g. "Home", "Tools"

  const children = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  // Split into folders and files, then sort each group alphabetically
  const folderEntries = entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const fileEntries = entries
    .filter((e) => e.isFile())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  // Add subfolders (sorted)
  for (const entry of folderEntries) {
    const childDirPath = path.join(dirPath, entry.name);
    const childRelPath = relativePath + "/" + entry.name;
    const folderNode = buildFolderNode(childDirPath, childRelPath);
    children.push(folderNode);
  }

  // Add files (sorted), as module/page/document with title and tags
  for (const entry of fileEntries) {
    const ext = path.extname(entry.name);
    const type = extToType(ext);
    if (!type) continue; // skip unsupported extensions

    const absFilePath = path.join(dirPath, entry.name);
    let content = "";
    try {
      content = fs.readFileSync(absFilePath, "utf8");
    } catch (e) {
      console.warn(`Warning: could not read file ${absFilePath}:`, e.message);
    }

    const id = filenameToId(entry.name);
    const title = extractTitleForFile(type, entry.name, content);
    const tags = extractTagsForFile(type, content);

    const filePath = path.join(relativePath, entry.name).replace(/\\/g, "/");

    children.push({
      type,   // "module" | "page" | "document"
      id,
      title,
      tags,
      file: filePath
    });
  }

  return {
    type: "folder",
    name,
    path: relativePath,
    children
  };
}

function main() {
  if (!fs.existsSync(homeDir)) {
    console.error(`Home directory not found at ${homeDir}`);
    process.exit(1);
  }

  const navigationTree = buildFolderNode(homeDir, "Home");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outFile, JSON.stringify(navigationTree, null, 2), "utf8");
  console.log(`Generated ${path.relative(process.cwd(), outFile)}`);
}

main();