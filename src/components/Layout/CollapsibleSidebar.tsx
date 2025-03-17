
import React from "react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/components/Layout/NavigationProvider";
import { SidebarToggle } from "./SidebarToggle";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      
      <ScrollArea className="flex-1">
        <div className={cn(
          "px-3 pb-6",
          isSidebarCollapsed ? "items-center" : ""
        )}>
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
