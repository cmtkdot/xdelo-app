
import { cn } from "@/lib/utils";
import { useIsMobile } from '@/hooks/useMobile';
import { useNavigation } from '@/hooks/useNavigation';
import { useEffect } from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: string;
  breadcrumbs?: { label: string; path: string }[];
  showBackButton?: boolean;
}

export function PageContainer({ 
  children, 
  className, 
  noPadding = false,
  title,
  breadcrumbs,
  showBackButton
}: PageContainerProps) {
  const isMobile = useIsMobile();
  const { setTitle, setBreadcrumbs, setShowBackButton, isSidebarCollapsed } = useNavigation();
  
  // Set navigation context values
  useEffect(() => {
    if (title) {
      setTitle(title);
    }
    if (breadcrumbs) {
      setBreadcrumbs(breadcrumbs);
    }
    if (typeof showBackButton !== 'undefined') {
      setShowBackButton(showBackButton);
    }
  }, [title, breadcrumbs, showBackButton, setTitle, setBreadcrumbs, setShowBackButton]);
  
  return (
    <div 
      className={cn(
        "mx-auto w-full transition-all duration-300",
        noPadding ? "" : isMobile ? "px-4 py-4" : "container px-4 py-8",
        className
      )}
    >
      {title && !isMobile && (
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
      )}
      {children}
    </div>
  );
}
