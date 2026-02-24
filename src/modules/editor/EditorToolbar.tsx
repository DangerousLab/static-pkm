/**
 * EditorToolbar
 * Two-row toolbar for the markdown editor:
 * - Row 1: mode toggle, auto-save toggle, save status, save button
 * - Row 2 (Edit mode only): WYSIWYG formatting buttons (removed - Milkdown handles this)
 *
 * @module EditorToolbar
 */

import { useEditorStore, EditorMode } from '@core/state/editorStore';

interface EditorToolbarProps {
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  onSave: () => void;
}

const MODES: { value: EditorMode; label: string }[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'source', label: 'Source' },
];

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  isSaving,
  lastSaved,
  isDirty,
  onSave,
}) => {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const autoSaveEnabled = useEditorStore((s) => s.autoSaveEnabled);
  const setAutoSave = useEditorStore((s) => s.setAutoSave);
  const lineNumbersEnabled = useEditorStore((s) => s.lineNumbersEnabled);
  const setLineNumbers = useEditorStore((s) => s.setLineNumbers);

  const savedLabel = lastSaved ? `Saved ${formatRelative(lastSaved)}` : null;

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
                onClick={() => setMode(m.value)}
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

          {/* Line numbers toggle */}
          <button
            onClick={() => setLineNumbers(!lineNumbersEnabled)}
            className={[
              'ml-2 px-2 py-1 rounded-md text-sm font-mono transition-colors',
              lineNumbersEnabled
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
            ].join(' ')}
            aria-label={lineNumbersEnabled ? 'Hide line numbers' : 'Show line numbers'}
            title={lineNumbersEnabled ? 'Line numbers: ON' : 'Line numbers: OFF'}
          >
            #
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
