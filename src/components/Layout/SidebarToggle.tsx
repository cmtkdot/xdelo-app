
import React from "react";
import { NavigationButton } from "./NavigationButton";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/hooks/useNavigation";

interface SidebarToggleProps {
  className?: string;
}

export function SidebarToggle({ className }: SidebarToggleProps) {
  const { isSidebarCollapsed } = useNavigation();
  
  return (
    <div className={cn(
      "flex items-center justify-center transition-all duration-200",
      isSidebarCollapsed ? "mb-4" : "mb-6",
      className
    )}>
      <NavigationButton sidebarToggle={true} />
    </div>
  );
}
