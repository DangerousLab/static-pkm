/**
 * CloseConfirmationModal
 * Shows when the user tries to close the app with unsaved changes
 * and auto-save is disabled.
 *
 * @module CloseConfirmationModal
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { writeFile } from '@core/ipc/commands';
import { useEditorStore } from '@core/state/editorStore';

export const CloseConfirmationModal: React.FC = () => {
  const showPrompt = useEditorStore((s) => s.showClosePrompt);
  const setShowPrompt = useEditorStore((s) => s.setShowClosePrompt);
  const dirtyDocuments = useEditorStore((s) => s.dirtyDocuments);
  const getDocumentEntry = useEditorStore((s) => s.getDocumentEntry);
  const clearDirtyDocuments = useEditorStore((s) => s.clearDirtyDocuments);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!showPrompt) return null;

  const dirtyCount = dirtyDocuments.size;

  const handleSaveAll = async (): Promise<void> => {
    setSaving(true);
    setSaveError(null);

    try {
      const saves = Array.from(dirtyDocuments).map(async (noteId) => {
        const entry = getDocumentEntry(noteId);
        if (entry) {
          await writeFile(entry.absolutePath, entry.content);
          console.log('[INFO] [CloseConfirmationModal] Saved:', noteId);
        }
      });

      await Promise.all(saves);
      clearDirtyDocuments();

      await invoke('force_close_window');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Save failed';
      console.error('[ERROR] [CloseConfirmationModal] Save failed:', error);
      setSaveError(msg);
      setSaving(false);
    }
  };

  const handleDontSave = async (): Promise<void> => {
    clearDirtyDocuments();
    await invoke('force_close_window');
  };

  const handleCancel = (): void => {
    setShowPrompt(false);
    setSaveError(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="editor-close-backdrop"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="editor-close-modal" role="dialog" aria-modal="true" aria-labelledby="close-modal-title">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4">
          <h2
            id="close-modal-title"
            className="text-lg font-semibold mb-2 text-gray-900 dark:text-white"
          >
            Unsaved Changes
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
            {dirtyCount === 1
              ? 'You have 1 unsaved document.'
              : `You have ${dirtyCount} unsaved documents.`}{' '}
            Save before closing?
          </p>

          {saveError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
              {saveError}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {saving ? 'Saving…' : dirtyCount > 1 ? 'Save All' : 'Save'}
            </button>

            <button
              onClick={handleDontSave}
              disabled={saving}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-900 dark:text-white rounded-md text-sm font-medium transition-colors"
            >
              Don&rsquo;t Save
            </button>

            <button
              onClick={handleCancel}
              disabled={saving}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CloseConfirmationModal;
