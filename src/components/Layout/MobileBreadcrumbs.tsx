
import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/components/Layout/NavigationProvider";
import { useIsMobile } from "@/hooks/useMobile";

interface MobileBreadcrumbsProps {
  className?: string;
}

export function MobileBreadcrumbs({ className }: MobileBreadcrumbsProps) {
  const { breadcrumbs } = useNavigation();
  const isMobile = useIsMobile();
  
  if (!isMobile || breadcrumbs.length <= 1) return null;

  return (
    <div className={cn("flex items-center text-xs text-muted-foreground", className)}>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          {index > 0 && <ChevronRight className="h-3 w-3 mx-1 flex-shrink-0" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="truncate">{crumb.label}</span>
          ) : (
            <Link 
              to={crumb.path}
              className="hover:text-foreground truncate transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
