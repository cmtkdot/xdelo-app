
import { toast as sonnerToast, type ToastT } from 'sonner';

type ToastVariant = 'default' | 'destructive' | 'success';

type ToastOptions = {
  description?: string;
  duration?: number;
  variant?: ToastVariant;
  action?: {
    label: string;
    onClick: () => void;
  };
};

// Helper function to handle both simple messages and complex toast configurations
export const toast = (
  message: string | { 
    title?: string; 
    description?: string;
    duration?: number;
    variant?: ToastVariant;
    action?: ToastOptions['action'];
  },
  options?: ToastOptions
) => {
  if (typeof message === 'string') {
    return sonnerToast(message, options);
  }
  
  const { title, description, duration, variant, action, ...rest } = message;
  return sonnerToast(title || '', { 
    description, 
    duration, 
    action,
    className: variant === 'destructive' ? 'destructive' : 
               variant === 'success' ? 'success' : '',
    ...rest 
  });
};

export const useToast = () => {
  return {
    toast: (message: Parameters<typeof toast>[0], options?: Parameters<typeof toast>[1]) => {
      return toast(message, options);
    }
  };
};
