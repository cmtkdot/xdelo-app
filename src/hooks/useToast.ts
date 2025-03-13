
// Re-export toast from sonner for convenience
import { toast, ToasterProps } from "sonner";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  [key: string]: any;
}

export function useToast() {
  const showToast = (props: ToastProps) => {
    if (props.variant === "destructive") {
      return toast.error(props.title || "", {
        description: props.description,
        action: props.action
      });
    }
    
    return toast(props.title || "", {
      description: props.description,
      action: props.action
    });
  };

  return { toast: showToast };
}

export type { ToasterProps };
