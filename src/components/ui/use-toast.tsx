
// Re-export toast from sonner for convenience
import { toast, ToasterProps } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  [key: string]: any;
}

export function useToast() {
  const isMobile = useIsMobile();

  const showToast = (props: ToastProps) => {
    // Determine positioning based on device
    const position = isMobile ? "bottom-center" : "top-right";
    
    if (props.variant === "destructive") {
      return toast.error(props.title || "", {
        description: props.description,
        action: props.action,
        position,
        className: isMobile ? "mobile-toast" : ""
      });
    }
    
    return toast(props.title || "", {
      description: props.description,
      action: props.action,
      position,
      className: isMobile ? "mobile-toast" : ""
    });
  };

  return { toast: showToast };
}

export type { ToasterProps };
