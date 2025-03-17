
import React from "react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/components/Layout/NavigationProvider";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarToggleProps {
  className?: string;
}

export function SidebarToggle({ className }: SidebarToggleProps) {
  const { isSidebarCollapsed, toggleSidebar } = useNavigation();
  
  return (
    <div className={cn(
      "flex items-center justify-center transition-all duration-200",
      isSidebarCollapsed ? "mb-4 px-2" : "mb-6 px-6",
      className
    )}>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={toggleSidebar}
        className={cn(
          "w-full h-8 flex items-center justify-between border",
          "hover:bg-muted transition-colors"
        )}
      >
        <span className={cn("font-medium", isSidebarCollapsed ? "sr-only" : "")}>
          {isSidebarCollapsed ? "" : "Collapse"}
        </span>
        {isSidebarCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
