
import { toast } from "sonner";

type ToastFunction = typeof toast & {
  success: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
};

export const useToast = () => ({
  toast: toast as ToastFunction,
});
