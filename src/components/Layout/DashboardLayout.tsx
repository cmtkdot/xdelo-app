
import React, { useState } from "react";
import { Header } from "./Header";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex min-h-[calc(100vh-4rem)] relative">
        {!isMobile && <AppSidebar />}
        
        <main className="flex-1 p-4 md:p-6 w-full overflow-auto">
          {isMobile && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="mb-4 -ml-2"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          )}
          
          {children}
        </main>
        
        {isMobile && (
          <MobileDrawer
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            position="left"
          >
            <div className="py-4">
              <AppSidebar />
            </div>
          </MobileDrawer>
        )}
      </div>
    </div>
  );
};
