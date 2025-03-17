
export interface TouchState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  swiping: boolean;
  direction: 'none' | 'left' | 'right' | 'up' | 'down';
}

export interface UseTouchInteractionProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  swipeThreshold?: number;
  preventDefaultOnSwipe?: boolean;
  preventScrollingWhenSwiping?: boolean;
}

export interface TouchHandlers {
  onTouchStart: (e: React.TouchEvent | TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent | TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent | TouchEvent) => void;
}
