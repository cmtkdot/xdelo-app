import React from "react";
import { 
  Home, 
  PanelTopOpen, 
  Image as ImageIcon, 
  PanelLeft, 
  FileText, 
  Settings, 
  Database, 
  Zap, 
  Music,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  Icon: LucideIcon;
  path: string;
  group?: 'main' | 'data' | 'settings';
  divider?: boolean;
}

interface NavItemsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isMobile?: boolean;
  isExpanded?: boolean;
}

export const navItems: NavItem[] = [
  { name: "Dashboard", Icon: Home, path: "/", group: "main" },
  { name: "Messages", Icon: PanelTopOpen, path: "/messages-enhanced", group: "main" },
  { name: "Gallery", Icon: ImageIcon, path: "/gallery", group: "main" },
  
  { name: "Media Table", Icon: PanelLeft, path: "/media-table", group: "data", divider: true },
  { name: "SQL Console", Icon: Database, path: "/sql-console", group: "data" },
  { name: "AI Chat", Icon: FileText, path: "/ai-chat", group: "data" },
  { name: "Audio Upload", Icon: Music, path: "/audio-upload", group: "data" },
  { name: "Make Automations", Icon: Zap, path: "/make-automations", group: "data" },
  
  { name: "Settings", Icon: Settings, path: "/settings", group: "settings", divider: true },
];

export const NavItems: React.FC<NavItemsProps> = ({ 
  currentPath, 
  onNavigate, 
  isMobile = false,
  isExpanded = true
}) => {
  return (
    <>
      {navItems.map((item) => {
        const isActive = currentPath === item.path;
        const Icon = item.Icon;
        
        return (
          <React.Fragment key={item.path}>
            {item.divider && (isExpanded || isMobile) && (
              <div className="h-px bg-gray-200 dark:bg-gray-800 my-3 mx-2" />
            )}
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "flex items-center transition-all duration-150 ease-in-out group w-full justify-start",
                isMobile 
                  ? "px-4 py-2.5 text-sm font-medium rounded-md mobile-touch-target h-auto min-h-[44px]"
                  : "px-2 py-2 text-sm font-medium rounded-md"
              )}
              onClick={() => onNavigate(item.path)}
            >
              <Icon className={cn(
                "flex-shrink-0 w-5 h-5 transition-colors duration-150",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground group-hover:text-foreground"
              )} />
              {(isExpanded || isMobile) && (
                <span className={cn(
                  "transition-opacity duration-150",
                  isMobile ? "" : "ml-3"
                )}>
                  {item.name}
                </span>
              )}
            </Button>
          </React.Fragment>
        );
      })}
    </>
  );
};
