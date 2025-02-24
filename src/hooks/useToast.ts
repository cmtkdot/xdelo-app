
import { toast as sonnerToast, type ToastT } from 'sonner';

type ToastOptions = {
  description?: string;
  duration?: number;
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
    action?: ToastOptions['action'];
  },
  options?: ToastOptions
) => {
  if (typeof message === 'string') {
    return sonnerToast(message, options);
  }
  
  const { title, description, duration, action, ...rest } = message;
  return sonnerToast(title || '', { description, duration, action, ...rest });
};

export const useToast = () => {
  return {
    toast: (message: Parameters<typeof toast>[0], options?: Parameters<typeof toast>[1]) => {
      return toast(message, options);
    }
  };
};
