
// Re-export toast from sonner for convenience
import { toast, Toast, ToastProps } from "sonner";

export function useToast() {
  return { toast };
}

export { type Toast, type ToastProps };
