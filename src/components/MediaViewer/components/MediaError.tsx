
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaErrorProps {
  message: string;
  onRetry?: () => void;
}

export function MediaError({ message, onRetry }: MediaErrorProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
      <div className="bg-black/80 text-white px-6 py-4 rounded-lg flex flex-col items-center">
        <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
        <p className="text-center mb-3">{message}</p>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
