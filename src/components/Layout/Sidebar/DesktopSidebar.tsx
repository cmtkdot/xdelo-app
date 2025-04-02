
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavItems } from "./NavItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

export const DesktopSidebar = () => {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleNavigate = (path: string) => {
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

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-full bg-white dark:bg-gray-900 transition-all duration-300 ease-in-out z-40",
        expanded ? "w-64" : "w-16",
        "border-r border-gray-200 dark:border-gray-800"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex flex-col h-full py-4">
        <div className="flex items-center justify-center h-16 px-4 mb-2">
          {expanded ? (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white text-left">XDELO</h1>
          ) : (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">X</h1>
          )}
        </div>

        <nav className="flex-1 px-2 space-y-1">
          <NavItems
            currentPath={location.pathname}
            onNavigate={handleNavigate}
            isExpanded={expanded}
          />
        </nav>

        <div className="px-2">
          <Button
            variant="ghost"
            className="w-full flex items-center justify-start"
            onClick={handleLogout}
          >
            <LogOut className="flex-shrink-0 w-5 h-5 text-muted-foreground group-hover:text-foreground" />
            {expanded && (
              <span className="ml-4 transition-opacity duration-150">
                Logout
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
