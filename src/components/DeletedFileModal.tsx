/**
 * DeletedFileModal
 * Shows when a file is deleted externally while open.
 * Offers to restore the file with current content or discard changes.
 *
 * @module DeletedFileModal
 */

import { useState } from 'react';
import { writeFile } from '@core/ipc/commands';

interface DeletedFileModalProps {
  absolutePath: string;
  content: string;
  onRestore: () => void;
  onDiscard: () => void;
}

export const DeletedFileModal: React.FC<DeletedFileModalProps> = ({
  absolutePath,
  content,
  onRestore,
  onDiscard,
}) => {
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);

    try {
      await writeFile(absolutePath, content);
      console.log('[INFO] [DeletedFileModal] File restored:', absolutePath);
      onRestore();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to restore file';
      console.error('[ERROR] [DeletedFileModal] Restore failed:', err);
      setError(msg);
      setRestoring(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="editor-close-backdrop"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="editor-close-modal" role="dialog" aria-modal="true" aria-labelledby="deleted-modal-title">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4">
          <h2
            id="deleted-modal-title"
            className="text-lg font-semibold mb-2 text-gray-900 dark:text-white"
          >
            File Deleted
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
            This file was deleted from disk. Would you like to restore it with your current changes?
          </p>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {restoring ? 'Restoring…' : 'Restore'}
            </button>

            <button
              onClick={onDiscard}
              disabled={restoring}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-900 dark:text-white rounded-md text-sm font-medium transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DeletedFileModal;
