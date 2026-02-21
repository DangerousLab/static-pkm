# Unstablon PKM - Development Guide

> TypeScript/React native PKM app built with Tauri 2.0

---

## Quick Start

**Stack**: Tauri 2.0 (Rust) + TypeScript 5 + React 18
**CSS**: Semantic CSS for layout/features + Tailwind CSS for UI components only
**Architecture**: 9-layer frontend (`src/`) + Rust backend (`src-tauri/`)
**Docs**: `../pkm-design-docs/docs/README.md` (always loaded); others on demand

**Key Feature**: Obsidian-compatible markdown + executable compute modules (Python/R/JS)

---

## Critical Rules

### ❌ PROHIBITED
```typescript
// NO setTimeout/setInterval for logic
setTimeout(() => loadData(), 100);

// NO class components
class Editor extends React.Component { }

// NO inline styles or Tailwind on layout components
<div style={{ padding: '16px' }}>              // WRONG
<div className="flex items-center gap-4 p-4">  // WRONG (use semantic CSS)

// NO implicit 'any' types
function load(path) { }
```

### ✅ REQUIRED
```typescript
// Functional components + hooks
const Editor: React.FC<Props> = ({ noteId }) => { };

// Explicit types + type-safe IPC
async function load(path: string): Promise<NoteData> {
  return await invoke<ContentData>('get_content', { id: noteId });
}

// Semantic CSS for layout, Tailwind for UI components only
<div className="app-header">  // Layout
<Button className="px-4 py-2 bg-blue-500">  // UI widget
```

**Also Required**:
- Offline-first (no network dependency)
- Error boundaries for React components
- Cleanup functions in `useEffect`
- Dark theme support (`dark:` prefix or CSS variables)

---

## Code Style

**TypeScript**:
- Strict mode, explicit function signatures
- Type inference OK for simple assignments

**React**:
- Functional components only
- Hooks: `useState`, `useEffect`, `useMemo`, `useCallback`
- Custom hooks: `useIPC`, `useContent`, `useBacklinks`

**CSS**:
- **Semantic CSS** → Layout/features (`css/` directory: `app-shell`, `app-header`, `sidebar`)
- **Tailwind CSS** → UI components only (`src/components/ui/*`: Button, Input, Card)
- **Never** inline styles or CSS modules

**IPC**:
```typescript
const result = await invoke<ContentData>('get_content', { id: noteId });
```

**Logging**:
```typescript
console.log('[INFO] [Editor] Loading note:', noteId);
console.error('[ERROR] [IPC] Failed:', error);
```

---

## CSS Architecture

```
src/css/                        # Semantic CSS (layout + features)
├── core/                       # variables.css, reset.css, safe-areas.css
├── layout/                     # app-shell.css, header.css, animations.css, responsive.css
├── components/                 # sidebar.css, navigation.css, search.css, content.css
├── features/                   # Future: stack-view.css, canvas-view.css
└── main.css                    # Import orchestrator

public/                         # Static assets (copied to dist)
├── assets/                     # Images, icons, logos
├── Home/                       # User content directory
├── vendor/                     # Third-party libraries
└── data/tree.json              # Navigation tree (build artifact)
```

**When to use**:
- **Semantic CSS** → Layout (AppShell, Header, Sidebar), features (search, navigation)
- **Tailwind** → UI library (`src/components/ui/*`), prototyping, simple widgets

---

## File Locations

| Component Type | Location | Example |
|----------------|----------|---------|
| React component | `src/modules/<feature>/` | `src/modules/editor/MarkdownEditor.tsx` |
| Custom hook | `src/hooks/` | `src/hooks/useContent.ts` |
| Zustand store | `src/core/state/` | `src/core/state/vaultStore.ts` |
| React Context | `src/contexts/` | `src/contexts/VaultContext.tsx` |
| IPC wrapper | `src/core/ipc/` | `src/core/ipc/commands.ts` |
| UI component | `src/components/ui/` | `src/components/ui/Button.tsx` |
| TypeScript types | `src/types/` | `src/types/content.ts` |
| Semantic CSS | `src/css/<category>/` | `src/css/layout/app-shell.css` |
| Static assets | `public/assets/` | `public/assets/logo.svg` |
| User content | `public/Home/` | `public/Home/Notes/example.md` |
| Build artifacts | `public/data/` | `public/data/tree.json` |

---

## Workflow

**Before coding**:
1. Determine layer (1-9) for file placement
2. Verify/create TypeScript types
3. Choose state approach (local, Context, Zustand)

**When coding**:
1. TypeScript interface for props
2. Error boundary wrapping
3. `useEffect` cleanup functions
4. Semantic CSS for layout, Tailwind for UI
5. Type-safe IPC: `invoke<T>()`

---

## Design Docs

@../pkm-design-docs/docs/README.md (always loaded)

**Load on demand**:
- **ARCHITECTURE.md** — System architecture, file placement
- **FRONTEND-GUIDE.md** — TypeScript/React patterns
- **BACKEND-GUIDE.md** — Rust/Tauri, IPC, SQLite
- **STATE-MANAGEMENT.md** — Zustand, Context, persistence
- **STYLING-GUIDE.md** — Tailwind, design tokens, theming
- **ASYNC-PATTERNS.md** — Async/await, error handling
- **MODULE-API.md** — Component contracts, hooks
- Others as needed (see README.md for full list)

---

## Stack Status

**Migration**: Complete — full TypeScript+React frontend + Tauri 2.0 backend active

All layers are open for modification:
- `/src` — TypeScript+React frontend
- `/src-tauri` — Rust backend (IPC commands, SQLite, file ops)
- `/public/Home/Tools/*.js` — Plain JS user modules (no build step)

User markdown format remains Obsidian-compatible.

---

## Gotchas

- **User modules**: `/Home/Tools/*.js` must stay plain JS (no build)
- **IPC typing**: Always use `invoke<T>()`
- **No circular deps**: Use events/Context/Zustand
- **Dark mode**: All components must support `dark:` variants

---

## Git Workflow

**Local-only by default** — never make commits or push without explicit user instruction.

**Critical rules**:
- **NEVER** create commits unless explicitly asked by the user
- **NEVER** push to remote without explicit permission
- **NEVER** add "Co-authored-by: Claude" or similar attribution to commit messages
- When user asks for commit message, provide:
  - **Title**: Conventional format (`feat(scope): description`)
  - **Description**: Concise 1-3 sentence explanation of changes

**Allowed with permission**: `git add`, `git commit`, `git branch`, `git checkout`
**Always require permission**: `git push`, `git push --force`, PRs, `gh` commands

---

## Output Style

**File paths**: Use exact paths (`src/modules/editor/MarkdownEditor.tsx`)
**Commits**: Conventional format (`feat(editor): migrate to React hooks`)
**Code**: Show full files unless asked for snippets

---

**Version**: 1.1
**Updated**: February 21, 2026
