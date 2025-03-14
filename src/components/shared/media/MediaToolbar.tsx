
import React from 'react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, FileDown, Settings, Share2 } from "lucide-react";
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface MediaToolbarAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

interface MediaToolbarProps {
  primaryActions?: MediaToolbarAction[];
  secondaryActions?: MediaToolbarAction[];
  className?: string;
}

export function MediaToolbar({ 
  primaryActions = [], 
  secondaryActions = [],
  className 
}: MediaToolbarProps) {
  return (
    <div className={cn("bg-muted/10 p-2 flex flex-wrap items-center justify-between gap-2", className)}>
      {primaryActions.length > 0 && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            {primaryActions.map(action => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button 
                    variant={action.variant || "outline"}
                    size="sm" 
                    onClick={action.onClick}
                    className="flex gap-1 items-center h-8"
                  >
                    {action.icon}
                    <span className="hidden sm:inline">{action.label}</span>
                  </Button>
                </TooltipTrigger>
                {action.tooltip && <TooltipContent>{action.tooltip}</TooltipContent>}
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      )}
      
      {secondaryActions.length > 0 && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            {secondaryActions.map(action => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button 
                    variant={action.variant || "outline"}
                    size="sm" 
                    onClick={action.onClick}
                    className="flex gap-1 items-center h-8"
                  >
                    {action.icon}
                    <span className="hidden sm:inline">{action.label}</span>
                  </Button>
                </TooltipTrigger>
                {action.tooltip && <TooltipContent>{action.tooltip}</TooltipContent>}
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
