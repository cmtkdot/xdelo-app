import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block">
                Xdelo App
              </span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <Button variant="ghost" className="w-9 px-0">
                <span className="sr-only">Search</span>
              </Button>
            </div>
            <nav className="flex items-center">
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>
    </ThemeProvider>
  );
}
