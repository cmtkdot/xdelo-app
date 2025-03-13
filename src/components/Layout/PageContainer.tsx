
import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from '@/hooks/useMobile';
import { useNavigation } from '@/hooks/useNavigation';
import { useEffect } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  
  const goBack = () => {
    navigate(-1);
  };
  
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
    
    // Cleanup
    return () => {
      setTitle('');
      setBreadcrumbs([]);
      setShowBackButton(false);
    };
  }, [title, breadcrumbs, showBackButton, setTitle, setBreadcrumbs, setShowBackButton]);
  
  return (
    <div 
      className={cn(
        "w-full h-full flex flex-col transition-all duration-300",
        noPadding ? "" : isMobile ? "px-4 py-4" : "container px-4 py-6",
        className
      )}
    >
      {/* Page header with title and breadcrumbs */}
      {(title || breadcrumbs?.length || showBackButton) && !isMobile && (
        <div className="mb-6 flex flex-col gap-2">
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb className="mb-2">
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={index}>
                      {isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbItem>
                          <BreadcrumbLink href={crumb.path}>{crumb.label}</BreadcrumbLink>
                        </BreadcrumbItem>
                      )}
                      {!isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          )}
          
          {/* Title and back button */}
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button 
                variant="outline" 
                size="icon" 
                onClick={goBack}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {title && (
              <h1 className="text-2xl font-bold">{title}</h1>
            )}
          </div>
        </div>
      )}
      
      {/* Page content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
