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
      <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="deleted-modal-title">
        <div className="ui-modal ui-modal-sm ui-p-md">
          <h2
            id="deleted-modal-title"
            className="ui-modal-title ui-mb-sm"
          >
            File Deleted
          </h2>

          <p className="text-sm text-text-muted ui-mb-md">
            This file was deleted from disk. Would you like to restore it with your current changes?
          </p>

          {error && (
            <p className="text-sm text-danger ui-mb-sm">
              {error}
            </p>
          )}

          <div className="ui-flex-col ui-gap-sm">
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="ui-btn ui-btn-primary"
            >
              {restoring ? 'Restoring…' : 'Restore'}
            </button>

            <button
              onClick={onDiscard}
              disabled={restoring}
              className="ui-btn ui-btn-secondary"
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
