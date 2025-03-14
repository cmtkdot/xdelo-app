
import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaNavigationProps {
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  className?: string;
}

export function MediaNavigation({
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  className
}: MediaNavigationProps) {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.addEventListener('keydown', handleKeydown);
    };
  }, [onNext, onPrevious, hasNext, hasPrevious]);

  return (
    <div className={`absolute inset-y-0 left-0 right-0 flex justify-between items-center ${className}`}>
      {hasPrevious && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 ml-2"
          onClick={onPrevious}
          aria-label="Previous media"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}
      
      {hasNext && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 mr-2"
          onClick={onNext}
          aria-label="Next media"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
