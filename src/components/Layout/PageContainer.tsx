
import { cn } from "@/lib/utils";
import { useIsMobile } from '@/hooks/useMobile';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageContainer({ children, className, noPadding = false }: PageContainerProps) {
  const isMobile = useIsMobile();
  
  return (
    <div 
      className={cn(
        "mx-auto w-full",
        noPadding ? "" : isMobile ? "px-4 py-4" : "container px-4 py-8",
        className
      )}
    >
      {children}
    </div>
  );
}
