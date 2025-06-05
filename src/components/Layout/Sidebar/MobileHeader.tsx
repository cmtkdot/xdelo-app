
import React from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useNavigation } from "@/components/Layout/NavigationProvider";
import { ThemeToggle } from "@/components/Theme/ThemeToggle";

export const MobileHeader = () => {
  const { toggleNavigation } = useNavigation();

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 z-50">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleNavigation}
          className="mr-2"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">XDELO</h1>
      </div>
      <ThemeToggle />
    </div>
  );
};
