
import React from "react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/hooks/useNavigation";
import { SidebarToggle } from "./SidebarToggle";

interface CollapsibleSidebarProps {
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSidebar({ children, className }: CollapsibleSidebarProps) {
  const { isSidebarCollapsed } = useNavigation();

  return (
    <div className={cn(
      "h-full bg-background border-r transition-all duration-300 flex flex-col",
      isSidebarCollapsed ? "w-16" : "w-64",
      className
    )}>
      <SidebarToggle />
      
      <div className={cn(
        "flex-1 overflow-y-auto px-3",
        isSidebarCollapsed ? "items-center" : ""
      )}>
        {children}
      </div>
    </div>
  );
}
