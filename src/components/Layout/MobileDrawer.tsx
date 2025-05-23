
import React, { useEffect } from "react";
import { Drawer, DrawerContent, DrawerClose, DrawerPortal } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

interface MobileDrawerProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: "left" | "right" | "bottom";
  showCloseButton?: boolean;
}

export function MobileDrawer({
  children,
  isOpen,
  onClose,
  title,
  position = "left",
  showCloseButton = true,
}: MobileDrawerProps) {
  const isMobile = useIsMobile();
  
  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isMobile && isOpen) {
      onClose();
    }
  }, [isMobile, isOpen, onClose]);

  // Only render on mobile
  if (!isMobile) return null;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerPortal>
        <DrawerContent 
          className={cn(
            "max-h-[90vh]", 
            position === "bottom" ? "rounded-t-xl" : "rounded-r-xl",
            "has-safe-area-bottom" // Add safe area padding
          )}
        >
          {(title || showCloseButton) && (
            <div className="flex justify-between items-center p-4 border-b">
              {title && <h2 className="font-medium text-lg">{title}</h2>}
              {showCloseButton && (
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" onClick={onClose} className="mobile-touch-target ml-auto">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DrawerClose>
              )}
            </div>
          )}
          <div className="overflow-y-auto p-4">{children}</div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
