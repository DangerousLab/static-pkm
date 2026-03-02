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
          <div className="ui-pill-group" role="group" aria-label="Editor mode">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={[
                  'ui-pill-btn',
                  mode === m.value ? 'is-active' : '',
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
            <span className="ui-status-text is-deleted">
              <span className="ui-status-dot" /> File deleted
            </span>
          )}

          {isSaving && !isDeleted && (
            <span className="ui-status-text is-saving">
              Saving…
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
