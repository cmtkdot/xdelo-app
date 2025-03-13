
import { useRef, useState, useEffect } from 'react';

interface TouchState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  swiping: boolean;
  direction: 'none' | 'left' | 'right' | 'up' | 'down';
}

interface UseTouchInteractionProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  swipeThreshold?: number;
  preventDefaultOnSwipe?: boolean;
  preventScrollingWhenSwiping?: boolean;
}

export function useTouchInteraction({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  swipeThreshold = 50,
  preventDefaultOnSwipe = false,
  preventScrollingWhenSwiping = false
}: UseTouchInteractionProps = {}) {
  const [touchState, setTouchState] = useState<TouchState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    swiping: false,
    direction: 'none'
  });
  
  const touchRef = useRef<TouchState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    swiping: false,
    direction: 'none'
  });
  
  const handleTouchStart = (e: React.TouchEvent | TouchEvent) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    
    touchRef.current = {
      ...touchRef.current,
      startX,
      startY,
      swiping: true,
      direction: 'none'
    };
    
    setTouchState(prev => ({
      ...prev,
      startX,
      startY,
      swiping: true,
      direction: 'none'
    }));
  };
  
  const handleTouchMove = (e: React.TouchEvent | TouchEvent) => {
    if (!touchRef.current.swiping) return;
    
    const touch = e.touches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    
    const deltaX = endX - touchRef.current.startX;
    const deltaY = endY - touchRef.current.startY;
    
    // Determine swipe direction
    let direction: TouchState['direction'] = 'none';
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > swipeThreshold) {
        direction = deltaX > 0 ? 'right' : 'left';
        
        if (preventDefaultOnSwipe) {
          e.preventDefault();
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > swipeThreshold) {
        direction = deltaY > 0 ? 'down' : 'up';
        
        if (preventScrollingWhenSwiping) {
          e.preventDefault();
        }
      }
    }
    
    touchRef.current = {
      ...touchRef.current,
      endX,
      endY,
      direction
    };
    
    setTouchState(prev => ({
      ...prev,
      endX,
      endY,
      direction
    }));
  };
  
  const handleTouchEnd = (e: React.TouchEvent | TouchEvent) => {
    const { direction } = touchRef.current;
    
    // Execute appropriate handler based on swipe direction
    if (direction === 'left' && onSwipeLeft) {
      onSwipeLeft();
    } else if (direction === 'right' && onSwipeRight) {
      onSwipeRight();
    } else if (direction === 'up' && onSwipeUp) {
      onSwipeUp();
    } else if (direction === 'down' && onSwipeDown) {
      onSwipeDown();
    }
    
    // Reset state
    touchRef.current = {
      ...touchRef.current,
      swiping: false,
      direction: 'none'
    };
    
    setTouchState(prev => ({
      ...prev,
      swiping: false,
      direction: 'none'
    }));
  };
  
  const bindTouchHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
  
  return {
    touchState,
    bindTouchHandlers
  };
}
