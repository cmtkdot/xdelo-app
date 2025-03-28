
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
  hasMoreItems: boolean;
}

export function LoadMoreButton({ onClick, isLoading, hasMoreItems }: LoadMoreButtonProps) {
  if (!hasMoreItems) {
    return null;
  }

  return (
    <div className="flex justify-center mt-8">
      <Button
        onClick={onClick}
        disabled={isLoading}
        variant="outline"
        className="min-w-[120px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          'Load More'
        )}
      </Button>
    </div>
  );
}
