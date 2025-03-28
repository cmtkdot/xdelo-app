
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface TabItem {
  title: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface ExpandableTabsProps {
  tabs: TabItem[];
  defaultIndex?: number;
  onChange?: (index: number | null) => void;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  activeColor?: string;
  inactiveColor?: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
}

export const ExpandableTabs = ({
  tabs,
  defaultIndex,
  onChange,
  className,
  iconClassName,
  labelClassName,
  activeColor = "text-primary",
  inactiveColor = "text-muted-foreground",
  expanded: controlledExpanded,
  defaultExpanded = false,
}: ExpandableTabsProps) => {
  const [activeTab, setActiveTab] = useState<number | null>(defaultIndex ?? null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Use controlled expanded state if provided
  const expanded = controlledExpanded !== undefined ? controlledExpanded : isExpanded;

  const handleTabClick = (index: number) => {
    // If clicking the active tab when expanded, collapse
    if (activeTab === index && expanded) {
      setActiveTab(null);
      setIsExpanded(false);
      onChange?.(null);
    } 
    // If clicking a new tab, set it active and expand
    else {
      setActiveTab(index);
      setIsExpanded(true);
      onChange?.(index);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex overflow-hidden transition-all duration-200 rounded-full border bg-background",
        expanded ? "px-3 gap-2" : "p-0",
        className
      )}
    >
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === index;
        
        return (
          <button
            key={index}
            type="button"
            disabled={tab.disabled}
            className={cn(
              "flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              expanded ? "py-2 px-0" : "p-2",
              isActive ? activeColor : inactiveColor,
              tab.disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => handleTabClick(index)}
          >
            <Icon className={cn("h-4 w-4", iconClassName)} />
            
            {expanded && (
              <span
                className={cn(
                  "ml-2 whitespace-nowrap transition-all duration-200",
                  labelClassName,
                  isActive ? "opacity-100" : "opacity-70"
                )}
              >
                {tab.title}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
