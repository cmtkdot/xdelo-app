
import React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  fullWidth?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

export function ResponsiveContainer({
  children,
  className,
  noPadding = false,
  fullWidth = false,
  maxWidth = "xl",
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto",
        {
          "px-4 sm:px-6 md:px-8": !noPadding,
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
