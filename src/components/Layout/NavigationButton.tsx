
import React from "react";
import { Menu, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/hooks/useNavigation";
import { useNavigate } from "react-router-dom";

interface NavigationButtonProps {
  className?: string;
}

export function NavigationButton({ className }: NavigationButtonProps) {
  const { isOpen, toggleNavigation, showBackButton } = useNavigation();
  const navigate = useNavigate();

  const handleClick = () => {
    if (showBackButton) {
      navigate(-1);
    } else {
      toggleNavigation();
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("mobile-touch-target", className)}
      onClick={handleClick}
      aria-label={showBackButton ? "Go back" : isOpen ? "Close menu" : "Open menu"}
    >
      {showBackButton ? (
        <ArrowLeft className="h-5 w-5" />
      ) : isOpen ? (
        <X className="h-5 w-5" />
      ) : (
        <Menu className="h-5 w-5" />
      )}
    </Button>
  );
}
