import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
}

const DEFAULT_OPTIONS: ConfirmOptions = {
  title: "",
  description: "",
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler",
  variant: "default",
};

export const ConfirmContext = createContext<ConfirmFn | null>(null);

export const useConfirm = (): ConfirmFn => {
  const fn = useContext(ConfirmContext);
  if (!fn)
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return fn;
};

export const useConfirmState = () => {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    options: DEFAULT_OPTIONS,
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((options) => {
    // Resolve any still-pending confirmation (cancelled) before starting a new
    // one, so its promise never leaks.
    resolveRef.current?.(false);
    setState({ open: true, options: { ...DEFAULT_OPTIONS, ...options } });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return { state, confirm, handleConfirm, handleCancel };
};
