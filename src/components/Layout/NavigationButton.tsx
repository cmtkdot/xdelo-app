
import React from "react";
import { Menu, X, ArrowLeft, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/components/Layout/NavigationProvider";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/useMobile";

interface NavigationButtonProps {
  className?: string;
  sidebarToggle?: boolean;
}

export function NavigationButton({ className, sidebarToggle = false }: NavigationButtonProps) {
  const { isOpen, toggleNavigation, showBackButton, isSidebarCollapsed, toggleSidebar } = useNavigation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleClick = () => {
    if (sidebarToggle) {
      toggleSidebar();
      return;
    }
    
    if (showBackButton) {
      navigate(-1);
    } else {
      toggleNavigation();
    }
  };

  // Determine which icon to show
  const getIcon = () => {
    if (sidebarToggle) {
      return isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />;
    }
    
    if (showBackButton) {
      return <ArrowLeft className="h-5 w-5" />;
    }
    
    return isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />;
  };

  // Determine the appropriate aria-label
  const getAriaLabel = () => {
    if (sidebarToggle) {
      return isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
    }
    
    if (showBackButton) {
      return "Go back";
    }
    
    return isOpen ? "Close menu" : "Open menu";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        isMobile || !sidebarToggle ? "mobile-touch-target" : "h-8 w-8",
        className
      )}
      onClick={handleClick}
      aria-label={getAriaLabel()}
    >
      {getIcon()}
    </Button>
  );
}
