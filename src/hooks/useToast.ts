import { useState, useEffect } from 'react';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

let toasts: Toast[] = [];

export const useToast = () => {
  const [toastsState, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setToasts(toasts);
  }, []);

  return {
    toasts: toastsState,
    dismiss: (index: number) => {
      toasts = toasts.filter((_, i) => i !== index);
      setToasts([...toasts]);
    }
  };
};

export const toast = (newToast: Toast) => {
  toasts = [...toasts, newToast];
  if (typeof window !== "undefined" && window.document) {
    const event = new CustomEvent("toast-update");
    window.dispatchEvent(event);
  }
};
