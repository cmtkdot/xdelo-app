import { DesktopSidebar } from "./DesktopSidebar";
import { MobileHeader } from "./MobileHeader";
import { MobileSidebar } from "./MobileSidebar";

export const AppSidebar = () => {
  return (
    <>
      <MobileHeader />
      <MobileSidebar />
      <DesktopSidebar />
    </>
  );
};
