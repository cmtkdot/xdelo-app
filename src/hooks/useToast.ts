
import { toast as sonnerToast } from "sonner";

type ToastOptions = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

const toast = {
  ...sonnerToast,
  error: (options: string | ToastOptions) => {
    if (typeof options === 'string') {
      return sonnerToast.error(options);
    }
    return sonnerToast.error(options.title, {
      description: options.description,
      action: options.action,
    });
  },
  success: (options: string | ToastOptions) => {
    if (typeof options === 'string') {
      return sonnerToast.success(options);
    }
    return sonnerToast.success(options.title, {
      description: options.description,
      action: options.action,
    });
  }
};

export const useToast = () => ({ toast });
