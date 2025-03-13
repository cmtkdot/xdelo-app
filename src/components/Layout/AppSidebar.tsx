
import React, { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Home,
  MessageSquare,
  Image as ImageIcon,
  PanelLeft,
  FileText,
  Settings,
  LogOut,
  Music,
  Database,
  PanelTopOpen,
  LucideIcon,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { useNavigation } from "@/hooks/useNavigation";
import { useToast } from "@/hooks/useToast";

interface NavItem {
  name: string;
  Icon: LucideIcon;
  path: string;
  group?: 'main' | 'data' | 'settings';
  divider?: boolean;
}

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();
  const { closeNavigation } = useNavigation();
  const { toast } = useToast();

  const navItems: NavItem[] = [
    { name: "Dashboard", Icon: Home, path: "/", group: "main" },
    { name: "Messages", Icon: MessageSquare, path: "/messages", group: "main" },
    { name: "Enhanced Messages", Icon: PanelTopOpen, path: "/messages-enhanced", group: "main" },
    { name: "Gallery", Icon: ImageIcon, path: "/gallery", group: "main" },
    
    { name: "Media Table", Icon: PanelLeft, path: "/media-table", group: "data", divider: true },
    { name: "SQL Console", Icon: Database, path: "/sql-console", group: "data" },
    { name: "AI Chat", Icon: FileText, path: "/ai-chat", group: "data" },
    { name: "Audio Upload", Icon: Music, path: "/audio-upload", group: "data" },
    { name: "Make Automations", Icon: Zap, path: "/make-automations", group: "data" },
    
    { name: "Settings", Icon: Settings, path: "/settings", group: "settings", divider: true },
  ];

  const handleNavigate = (path: string) => {
    if (isMobile) {
      closeNavigation();
    }
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({ 
        title: "Logged out successfully", 
        variant: "default" 
      });
    } catch (error) {
      toast({ 
        title: "Error signing out", 
        description: "Please try again.", 
        variant: "destructive" 
      });
    }
  };

  // In mobile mode, don't use hover effects and always show full sidebar
  if (isMobile) {
    return (
      <div className="w-full">
        <div className="flex flex-col py-4">
          <div className="flex items-center justify-center h-12 px-4 mb-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">XDELO</h1>
          </div>

          <nav className="space-y-1 touch-scroll max-h-[70vh]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.Icon;
              
              return (
                <React.Fragment key={item.path}>
                  {item.divider && <div className="h-px bg-gray-200 dark:bg-gray-800 my-3 mx-2" />}
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "flex items-center w-full justify-start px-4 py-3 text-sm font-medium rounded-md transition-all mobile-touch-target h-auto min-h-[44px]",
                    )}
                    onClick={() => handleNavigate(item.path)}
                  >
                    <Icon className={cn(
                      "flex-shrink-0 w-5 h-5 mr-3",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span>{item.name}</span>
                  </Button>
                </React.Fragment>
              );
            })}
          </nav>

          <div className="mt-auto px-2 pt-4">
            <Button
              variant="ghost"
              className="flex items-center w-full justify-start px-4 py-3 text-sm font-medium mobile-touch-target h-auto min-h-[44px]"
              onClick={handleLogout}
            >
              <LogOut className="flex-shrink-0 w-5 h-5 mr-3 text-muted-foreground" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop version with expandable sidebar
  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-full bg-white dark:bg-gray-900 transition-all duration-300 ease-in-out z-50",
        expanded ? "w-64" : "w-16",
        "border-r border-gray-200 dark:border-gray-800"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex flex-col h-full py-4">
        <div className="flex items-center justify-center h-16 px-4">
          {expanded ? (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">XDELO</h1>
          ) : (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">X</h1>
          )}
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.Icon;
            
            return (
              <React.Fragment key={item.path}>
                {item.divider && expanded && <div className="h-px bg-gray-200 dark:bg-gray-800 my-3 mx-2" />}
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-150 ease-in-out group w-full justify-start",
                  )}
                  onClick={() => handleNavigate(item.path)}
                >
                  <Icon className={cn(
                    "flex-shrink-0 w-6 h-6 transition-colors duration-150",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {expanded && (
                    <span className="ml-3 transition-opacity duration-150">
                      {item.name}
                    </span>
                  )}
                </Button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="px-2">
          <Button
            variant="ghost"
            className="w-full flex items-center justify-start"
            onClick={handleLogout}
          >
            <LogOut className="flex-shrink-0 w-6 h-6 text-muted-foreground group-hover:text-foreground" />
            {expanded && (
              <span className="ml-3 transition-opacity duration-150">
                Logout
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
