
import React, { useEffect } from "react";
import { Header } from "./Header";
import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { MobileDrawer } from "./MobileDrawer";
import { useNavigation } from "@/components/Layout/NavigationProvider";
import { useTouchInteraction } from "@/hooks/useTouchInteraction";
import { MobileBottomNav } from "./MobileBottomNav";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBottomNav?: boolean;
}

export const DashboardLayout = ({ 
  children, 
  title,
  showBottomNav = true
}: DashboardLayoutProps) => {
  const isMobile = useIsMobile();
  const { isOpen, openNavigation, closeNavigation, setTitle } = useNavigation();
  
  // Set page title when provided
  useEffect(() => {
    if (title) {
      setTitle(title);
    }
  }, [title, setTitle]);
  
  // Setup swipe gestures for mobile
  const { bindTouchHandlers } = useTouchInteraction({
    onSwipeRight: () => {
      if (isMobile) {
        openNavigation();
      }
    },
    swipeThreshold: 50,
    preventScrollingWhenSwiping: false
  });
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex min-h-[calc(100vh-4rem)] relative">
        {!isMobile && <AppSidebar />}
        
        <main 
          className={cn(
            "flex-1 p-4 md:p-6 w-full overflow-auto",
            isMobile && showBottomNav && "pb-20"
          )}
          {...(isMobile ? bindTouchHandlers : {})}
        >
          {children}
        </main>
        
        {isMobile && (
          <MobileDrawer
            isOpen={isOpen}
            onClose={closeNavigation}
            position="left"
          >
            <div className="py-4">
              <AppSidebar />
            </div>
          </MobileDrawer>
        )}
      </div>
      
      {isMobile && showBottomNav && <MobileBottomNav />}
    </div>
  );
};
