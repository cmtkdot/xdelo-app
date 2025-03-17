
import React from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { MobileHeader } from "./MobileHeader";
import { MobileSidebar } from "./MobileSidebar";
import { DesktopSidebar } from "./DesktopSidebar";

export const AppSidebar = () => {
  const isMobile = useIsMobile();

  return (
    <>
      {isMobile ? (
        <>
          <MobileHeader />
          <MobileSidebar />
        </>
      ) : (
        <DesktopSidebar />
      )}
    </>
  );
};
