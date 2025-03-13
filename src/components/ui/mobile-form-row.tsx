
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
}

export function MobileFormRow({
  label,
  htmlFor,
  className,
  children,
  error,
  description,
  fullWidth = false
}: MobileFormRowProps) {
  return (
    <div className={cn(
      "space-y-2",
      fullWidth ? "w-full" : "",
      className
    )}>
      <div className="flex flex-col space-y-1">
        <Label 
          htmlFor={htmlFor} 
          className="text-sm font-medium"
        >
          {label}
        </Label>
        
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      
      {children}
      
      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
