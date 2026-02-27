import React, { useEffect, useCallback } from 'react';
import { ConfirmContext, useConfirmState } from '../hooks/useConfirm';

/**
 * Provider that wraps the app and exposes the confirm() function via context.
 * Renders the modal overlay when a confirmation is pending.
 */
export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, confirm, handleConfirm, handleCancel } = useConfirmState();
  const { open, options } = state;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel();
  }, [handleCancel]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const isDanger = options.variant === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open ? (
        <div className="confirm-overlay">
          <div className="confirm-backdrop" onClick={handleCancel} />
          <div className="confirm-panel" role="dialog" aria-modal="true">
            <h3 className="confirm-title">{options.title}</h3>
            <p className="confirm-description">{options.description}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary confirm-btn" onClick={handleCancel}>
                {options.cancelLabel}
              </button>
              <button
                className={`btn confirm-btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirm}
                autoFocus
              >
                {options.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
};
