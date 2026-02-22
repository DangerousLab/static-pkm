/**
 * EditorToolbar
 * Two-row toolbar for the markdown editor:
 * - Row 1: mode toggle, auto-save toggle, save status, save button
 * - Row 2 (Edit mode only): WYSIWYG formatting buttons
 *
 * Formatting buttons dispatch CM6 transactions via `getView()`.
 *
 * @module EditorToolbar
 */

import type { EditorView } from '@codemirror/view';
import { useEditorStore, EditorMode } from '@core/state/editorStore';

interface EditorToolbarProps {
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  onSave: () => void;
  /** Getter for the active CM6 EditorView (null when not in Edit mode). */
  getView: () => EditorView | null;
  /** Called just before the mode changes — used to capture scroll position. */
  onBeforeModeChange?: () => void;
}

const MODES: { value: EditorMode; label: string }[] = [
  { value: 'read', label: 'Read' },
  { value: 'edit', label: 'Edit' },
  { value: 'source', label: 'Source' },
];

// ── Formatting helpers ────────────────────────────────────────────────────────

type FormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'link'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'blockquote'
  | 'hr';

/**
 * Wraps the CM6 selection (or inserts placeholder text) with markdown syntax.
 * Dispatches a single transaction so the action is undoable.
 */
function formatSelection(view: EditorView, type: FormatType): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selectedText = state.sliceDoc(from, to);

  // Inline wrappers: wrap selection or insert placeholder
  const inlineWrap = (marker: string, placeholder: string): void => {
    const inner = selectedText || placeholder;
    view.dispatch({
      changes: { from, to, insert: `${marker}${inner}${marker}` },
      selection: selectedText
        ? { anchor: from + marker.length, head: from + marker.length + inner.length }
        : { anchor: from + marker.length, head: from + marker.length + placeholder.length },
    });
  };

  // Line prefix: insert/toggle a prefix at the start of the current line
  const linePrefix = (prefix: string): void => {
    const line = state.doc.lineAt(from);
    const alreadyHas = line.text.startsWith(prefix);
    if (alreadyHas) {
      view.dispatch({
        changes: { from: line.from, to: line.from + prefix.length, insert: '' },
      });
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix },
      });
    }
  };

  switch (type) {
    case 'bold':          return inlineWrap('**', 'bold text');
    case 'italic':        return inlineWrap('*', 'italic text');
    case 'strikethrough': return inlineWrap('~~', 'strikethrough');
    case 'code':          return inlineWrap('`', 'code');
    case 'link': {
      const label = selectedText || 'link text';
      const insert = `[${label}](url)`;
      view.dispatch({
        changes: { from, to, insert },
        // Place cursor on "url" so user can type it immediately
        selection: { anchor: from + label.length + 3, head: from + insert.length - 1 },
      });
      return;
    }
    case 'h1':          return linePrefix('# ');
    case 'h2':          return linePrefix('## ');
    case 'h3':          return linePrefix('### ');
    case 'blockquote':  return linePrefix('> ');
    case 'hr': {
      const line = state.doc.lineAt(from);
      const insertPos = line.to;
      view.dispatch({
        changes: { from: insertPos, to: insertPos, insert: '\n---' },
        selection: { anchor: insertPos + 4 },
      });
      return;
    }
  }
}

// ── Format button definitions ─────────────────────────────────────────────────

interface FmtButton {
  type: FormatType;
  label: string;
  title: string;
}

const FMT_BUTTONS: (FmtButton | 'divider')[] = [
  { type: 'h1', label: 'H1', title: 'Heading 1' },
  { type: 'h2', label: 'H2', title: 'Heading 2' },
  { type: 'h3', label: 'H3', title: 'Heading 3' },
  'divider',
  { type: 'bold', label: 'B', title: 'Bold (Ctrl+B)' },
  { type: 'italic', label: 'I', title: 'Italic (Ctrl+I)' },
  { type: 'strikethrough', label: 'S', title: 'Strikethrough' },
  'divider',
  { type: 'code', label: '<>', title: 'Inline code' },
  { type: 'link', label: '⌘K', title: 'Insert link' },
  'divider',
  { type: 'blockquote', label: '❝', title: 'Blockquote' },
  { type: 'hr', label: '—', title: 'Horizontal rule' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  isSaving,
  lastSaved,
  isDirty,
  onSave,
  getView,
  onBeforeModeChange,
}) => {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const autoSaveEnabled = useEditorStore((s) => s.autoSaveEnabled);
  const setAutoSave = useEditorStore((s) => s.setAutoSave);

  const savedLabel = lastSaved ? `Saved ${formatRelative(lastSaved)}` : null;

  const handleFormat = (type: FormatType): void => {
    const view = getView();
    if (!view) return;
    formatSelection(view, type);
    // Return focus to the editor after a toolbar button click
    view.focus();
  };

  return (
    <div className="editor-toolbar">
      {/* ── Row 1: Mode toggle + status + save ────────────────────────────────── */}
      <div className="editor-toolbar-row">
        <div className="editor-toolbar-left">
          {/* Mode toggle pill group */}
          <div
            className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5"
            role="group"
            aria-label="Editor mode"
          >
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => { onBeforeModeChange?.(); setMode(m.value); }}
                className={[
                  'px-3 py-1 rounded text-sm font-medium transition-colors',
                  mode === m.value
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                ].join(' ')}
                aria-label={`Switch to ${m.label} mode`}
                aria-pressed={mode === m.value}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Auto-save toggle */}
          <button
            onClick={() => setAutoSave(!autoSaveEnabled)}
            className={[
              'ml-2 px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
              autoSaveEnabled
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
            ].join(' ')}
            aria-label={autoSaveEnabled ? 'Auto-save is on, click to disable' : 'Auto-save is off, click to enable'}
            title={autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF'}
          >
            <span className="text-xs">{autoSaveEnabled ? '●' : '○'}</span>
            Auto-save
          </button>
        </div>

        {/* Right: Status + Save button */}
        <div className="editor-toolbar-right">
          {isDirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Unsaved changes
            </span>
          )}

          {savedLabel && !isDirty && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {savedLabel}
            </span>
          )}

          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            aria-label="Save document"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Row 2: Formatting toolbar (Edit mode only) ────────────────────────── */}
      {mode === 'edit' && (
        <div className="editor-toolbar-row editor-format-row" role="toolbar" aria-label="Text formatting">
          {FMT_BUTTONS.map((item, idx) => {
            if (item === 'divider') {
              return <div key={`div-${idx}`} className="editor-fmt-divider" aria-hidden="true" />;
            }
            return (
              <button
                key={item.type}
                className="editor-fmt-btn"
                title={item.title}
                aria-label={item.title}
                onMouseDown={(e) => {
                  // Prevent the editor from losing focus on button click
                  e.preventDefault();
                  handleFormat(item.type);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Helper ─────────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
