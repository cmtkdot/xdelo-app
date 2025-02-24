
import { toast as sonnerToast } from 'sonner';

export const toast = sonnerToast;

export const useToast = () => {
  return {
    toast: sonnerToast
  };
};
