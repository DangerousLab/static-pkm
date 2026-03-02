import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Close on overlay click */
  closeOnOverlay?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
}

/**
 * Modal dialog component
 */
function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
}: ModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement;

    // Focus first focusable element
    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements?.[0]?.focus();

    return () => {
      previousActiveElement?.focus();
    };
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="ui-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={`ui-modal ui-modal-${size}`}
      >
        {/* Header */}
        {title && (
          <div className="ui-modal-header">
            <h2 id="modal-title" className="ui-modal-title">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="ui-modal-close"
              aria-label="Close modal"
            >
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>×</span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="ui-modal-content">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
