
import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  fullWidth?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  mobilePadding?: "none" | "sm" | "md" | "lg";
}

export function ResponsiveContainer({
  children,
  className,
  noPadding = false,
  fullWidth = false,
  maxWidth = "xl",
  mobilePadding = "md",
}: ResponsiveContainerProps) {
  const isMobile = useIsMobile();
  
  const mobilePaddingClasses = {
    none: "px-0",
    sm: "px-2",
    md: "px-4",
    lg: "px-6"
  };
  
  return (
    <div
      className={cn(
        "w-full mx-auto",
        {
          // Desktop padding
          "px-4 sm:px-6 md:px-8": !noPadding && !isMobile,
          
          // Mobile padding
          [mobilePaddingClasses[mobilePadding]]: !noPadding && isMobile,
          
          // Max width
          "max-w-full": fullWidth,
          "max-w-sm": maxWidth === "sm" && !fullWidth,
          "max-w-md": maxWidth === "md" && !fullWidth,
          "max-w-lg": maxWidth === "lg" && !fullWidth,
          "max-w-xl": maxWidth === "xl" && !fullWidth,
          "max-w-2xl": maxWidth === "2xl" && !fullWidth,
        },
        className
      )}
    >
      {children}
    </div>
  );
}
