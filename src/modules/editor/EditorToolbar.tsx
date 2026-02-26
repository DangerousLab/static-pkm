/**
 * EditorToolbar
 * Simplified toolbar for Obsidian-style auto-save:
 * - Mode toggle, save status
 *
 * @module EditorToolbar
 */

import { useEditorStore, EditorMode } from '@core/state/editorStore';

interface EditorToolbarProps {
  isSaving: boolean;
  isDeleted: boolean;
}

const MODES: { value: EditorMode; label: string }[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'source', label: 'Source' },
];

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  isSaving,
  isDeleted,
}) => {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);

  return (
    <div className="editor-toolbar">
      {/* ── Row 1: Mode toggle + status ─────────────────────────────────────── */}
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
        </div>

        {/* Right: Status (no save button with auto-save) */}
        <div className="editor-toolbar-right">
          {isDeleted && (
            <span className="deleted-indicator">
              <span className="deleted-dot" /> File deleted
            </span>
          )}

          {isSaving && !isDeleted && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Saving…
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
