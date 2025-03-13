
// Re-export toast from sonner for convenience
import { toast, ToasterProps } from "sonner";

export function useToast() {
  return { toast };
}

export type { ToasterProps };
