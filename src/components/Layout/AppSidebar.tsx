import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { ThemeToggle } from "@/components/Theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';

interface NavItem {
  name: string;
  Icon: LucideIcon;
  path: string;
  group?: 'main' | 'data' | 'settings';
  divider?: boolean;
}

export const AppSidebar = () => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

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
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-150 ease-in-out group",
                  isActive 
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200" 
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                )}
              >
                <Icon className={cn(
                  "flex-shrink-0 w-6 h-6 mr-3 transition-colors duration-150",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-500 dark:text-gray-400"
                )} />
                <motion.span
                  initial={false}
                  animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  {item.name}
                </motion.span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center w-full px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 transition-all duration-150 ease-in-out group",
            )}
          >
            <LogOut className="flex-shrink-0 w-6 h-6 mr-3 text-gray-400 group-hover:text-gray-500 dark:text-gray-400" />
            <motion.span
              initial={false}
              animate={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap overflow-hidden"
            >
              Logout
            </motion.span>
          </button>
        </div>
      </div>
    </div>
  );
};
