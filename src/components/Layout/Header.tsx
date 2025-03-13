
import { Link } from "react-router-dom";
import { ThemeToggle } from "../Theme/ThemeToggle";
import { useTheme } from "../Theme/ThemeProvider";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { NavigationButton } from "./NavigationButton";
import { MobileBreadcrumbs } from "./MobileBreadcrumbs";
import { useNavigation } from "@/hooks/useNavigation";

export const Header = () => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { title } = useNavigation();
  
  const logoSrc = theme === "dark" 
    ? "/lovable-uploads/xdelo-white-logo.png"
    : "/lovable-uploads/xdelo-blackfont.png";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={cn(
        "flex h-14 items-center",
        isMobile ? "px-3" : "container"
      )}>
        {isMobile && <NavigationButton className="mr-2" />}
        
        <div className="flex flex-1 items-center">
          {!isMobile && <div className="flex-1" />} {/* Left spacer on desktop */}
          
          <div className="flex flex-col items-center justify-center">
            <Link to="/" className="flex items-center justify-center">
              <img 
                src={logoSrc} 
                alt="Xdelo" 
                className={cn(
                  "transition-all duration-200",
                  isMobile ? "h-6" : "h-8"
                )}
              />
            </Link>
            
            {isMobile && <MobileBreadcrumbs className="mt-0.5" />}
          </div>
          
          <div className="flex-1 flex justify-end items-center space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
