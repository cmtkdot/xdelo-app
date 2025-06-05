
import { useState, useRef, useCallback } from 'react';
import { TouchState } from './types';

/**
 * Hook that provides swipe detection functionality
 * @param swipeThreshold Minimum distance in pixels to trigger a swipe
 * @param preventDefaultOnSwipe Whether to prevent default browser behavior on swipe
 * @param preventScrollingWhenSwiping Whether to prevent scrolling when swiping vertically
 */
export function useSwipeDetection(
  swipeThreshold: number = 50,
  preventDefaultOnSwipe: boolean = false,
  preventScrollingWhenSwiping: boolean = false
) {
  const [touchState, setTouchState] = useState<TouchState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    swiping: false,
    direction: 'none'
  });
  
  // Use ref for real-time access during touch events
  const touchRef = useRef<TouchState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    swiping: false,
    direction: 'none'
  });
  
  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    
    const newState = {
      ...touchRef.current,
      startX,
      startY,
      swiping: true,
      direction: 'none' as const
    };
    
    touchRef.current = newState;
    setTouchState(newState);
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
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
    
    const newState = {
      ...touchRef.current,
      endX,
      endY,
      direction
    };
    
    touchRef.current = newState;
    setTouchState(newState);
  }, [swipeThreshold, preventDefaultOnSwipe, preventScrollingWhenSwiping]);
  
  const handleTouchEnd = useCallback(() => {
    const newState = {
      ...touchRef.current,
      swiping: false,
      direction: 'none' as const
    };
    
    touchRef.current = newState;
    setTouchState(newState);
    
    return touchRef.current.direction;
  }, []);
  
  return {
    touchState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}
