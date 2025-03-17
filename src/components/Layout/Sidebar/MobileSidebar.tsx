
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/components/Layout/NavigationProvider";
import { AnimatePresence, motion } from "framer-motion";
import { NavItems } from "./NavItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

export const MobileSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, closeNavigation } = useNavigation();
  const { toast } = useToast();

  const handleNavigate = (path: string) => {
    navigate(path);
    closeNavigation();
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
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={closeNavigation}
          />
          
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[270px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 overflow-y-auto"
          >
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-xl font-bold">XDELO</h1>
              <Button variant="ghost" size="icon" onClick={closeNavigation}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="py-4">
              <nav className="space-y-1 px-2">
                <NavItems
                  currentPath={location.pathname}
                  onNavigate={handleNavigate}
                  isMobile={true}
                />
              </nav>

              <div className="mt-4 px-2">
                <Button
                  variant="ghost"
                  className="flex items-center w-full justify-start px-4 py-2.5 text-sm font-medium mobile-touch-target h-auto min-h-[44px] mb-12"
                  onClick={handleLogout}
                >
                  <LogOut className="flex-shrink-0 w-5 h-5 text-muted-foreground" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
