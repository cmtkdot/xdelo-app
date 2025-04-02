
import React from 'react';
import { Button } from '@/components/ui/button';
import { Wrench, RefreshCw } from 'lucide-react';
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function MediaFixButton() {
  const { 
    isProcessing, 
    standardizeStoragePaths, 
    fixMediaUrls 
  } = useMediaUtils();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2"
          disabled={isProcessing}
        >
          <Wrench className="h-4 w-4" />
          Media Utilities
          {isProcessing && <RefreshCw className="h-3 w-3 animate-spin" />}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-56 p-2">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={isProcessing}
            onClick={() => standardizeStoragePaths(100)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <span>Standardize Storage Paths</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={isProcessing}
            onClick={() => fixMediaUrls(100)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <span>Fix Public URLs</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
