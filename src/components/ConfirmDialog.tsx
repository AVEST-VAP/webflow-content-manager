import React, { useEffect, useCallback, useRef, useId } from "react";
import { ConfirmContext, useConfirmState } from "../hooks/useConfirm";

/**
 * Provider that wraps the app and exposes the confirm() function via context.
 * Renders the modal overlay when a confirmation is pending. The dialog is
 * keyboard-accessible: Escape cancels, Tab is trapped inside the panel, and
 * focus is restored to the trigger when it closes.
 */
export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { state, confirm, handleConfirm, handleCancel } = useConfirmState();
  const { open, options } = state;
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusable = useCallback((): HTMLElement[] => {
    const panel = panelRef.current;
    if (!panel) return [];
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
      ),
    );
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [handleCancel, getFocusable],
  );

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to whatever was focused before the dialog opened.
      previousFocusRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  const isDanger = options.variant === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open ? (
        <div className="confirm-overlay">
          <div className="confirm-backdrop" onClick={handleCancel} />
          <div
            className="confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            ref={panelRef}
          >
            <h3 id={titleId} className="confirm-title">
              {options.title}
            </h3>
            <p id={descId} className="confirm-description">
              {options.description}
            </p>
            <div className="confirm-actions">
              <button
                className="btn btn-secondary confirm-btn"
                onClick={handleCancel}
              >
                {options.cancelLabel}
              </button>
              <button
                className={`btn confirm-btn ${isDanger ? "btn-danger" : "btn-primary"}`}
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
