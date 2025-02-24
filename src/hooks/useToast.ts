
import { toast as sonnerToast, Toast } from "sonner";

type ToastOptions = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

type CustomToast = {
  (options: ToastOptions | string): void;
  error: (options: ToastOptions | string) => void;
  success: (options: ToastOptions | string) => void;
};

const toast: CustomToast = ((options: ToastOptions | string) => {
  if (typeof options === 'string') {
    return sonnerToast(options);
  }
  return sonnerToast(options.title || '', {
    description: options.description,
    action: options.action,
  });
}) as CustomToast;

toast.error = (options: ToastOptions | string) => {
  if (typeof options === 'string') {
    return sonnerToast.error(options);
  }
  return sonnerToast.error(options.title || '', {
    description: options.description,
    action: options.action,
  });
};

toast.success = (options: ToastOptions | string) => {
  if (typeof options === 'string') {
    return sonnerToast.success(options);
  }
  return sonnerToast.success(options.title || '', {
    description: options.description,
    action: options.action,
  });
};

export const useToast = () => ({ toast });
