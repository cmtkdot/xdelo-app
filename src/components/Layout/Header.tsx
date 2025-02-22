import { Link } from "react-router-dom";
import { ThemeToggle } from "../Theme/ThemeToggle";
import { useTheme } from "../Theme/ThemeProvider";

export const Header = () => {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" 
    ? "/lovable-uploads/xdelo-white-logo.png"
    : "/lovable-uploads/xdelo-blackfont.png";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          <div className="flex-1" /> {/* Left spacer */}
          <Link to="/" className="flex items-center justify-center">
            <img 
              src={logoSrc} 
              alt="Xdelo" 
              className="h-8"
            />
          </Link>
          <div className="flex-1 flex justify-end"> {/* Right spacer with theme toggle */}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};