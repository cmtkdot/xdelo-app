
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/useToast"

export function Toaster() {
  const { toast } = useToast()

  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  )
}
