
import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface MobileFormRowProps {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
  error?: string;
  description?: string;
  fullWidth?: boolean;
  required?: boolean;
  touchFriendly?: boolean;
}

export function MobileFormRow({
  label,
  htmlFor,
  className,
  children,
  error,
  description,
  fullWidth = false,
  required = false,
  touchFriendly = true
}: MobileFormRowProps) {
  return (
    <div className={cn(
      "space-y-2",
      fullWidth ? "w-full" : "",
      touchFriendly ? "mb-4" : "", // Add more margin for touch-friendly spacing
      className
    )}>
      <div className="flex flex-col space-y-1">
        <Label 
          htmlFor={htmlFor} 
          className={cn(
            "text-sm font-medium flex items-center",
            touchFriendly ? "text-base" : "text-sm" // Larger text for touch devices
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        
        {description && (
          <p className={cn(
            "text-muted-foreground",
            touchFriendly ? "text-sm" : "text-xs"
          )}>
            {description}
          </p>
        )}
      </div>
      
      <div className={cn(
        touchFriendly ? "min-h-[44px]" : "" // Ensure minimum touch target height
      )}>
        {children}
      </div>
      
      {error && (
        <p className="text-xs text-destructive animate-shake">
          {error}
        </p>
      )}
    </div>
  );
}
