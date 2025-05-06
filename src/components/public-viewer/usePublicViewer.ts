
import { useState, useCallback } from 'react';
import { Message } from '@/types';

interface UsePublicViewerResult {
  isOpen: boolean;
  currentGroup: Message[];
  currentIndex: number;
  hasNext: boolean;
  hasPrevious: boolean;
  openViewer: (group: Message[], initialIndex?: number) => void;
  closeViewer: () => void;
  goToNextGroup: () => void;
  goToPreviousGroup: () => void;
  setCurrentIndex: (index: number) => void;
}

export function usePublicViewer(mediaGroups: Message[][]): UsePublicViewerResult {
  const [isOpen, setIsOpen] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const currentGroup = mediaGroups[currentGroupIndex] || [];
  const hasNext = currentGroupIndex < mediaGroups.length - 1;
  const hasPrevious = currentGroupIndex > 0;
  
  const openViewer = useCallback((group: Message[], initialIndex: number = 0) => {
    // Find the group index in the media groups array
    const groupIndex = mediaGroups.findIndex(g => 
      g.some(item => group.some(groupItem => groupItem.id === item.id))
    );
    
    if (groupIndex !== -1) {
      setCurrentGroupIndex(groupIndex);
      setCurrentIndex(initialIndex);
      setIsOpen(true);
    } else if (group.length > 0) {
      // If group not found in mediaGroups, still allow opening with the provided group
      setCurrentGroupIndex(0); // Reset to first group
      setCurrentIndex(initialIndex);
      setIsOpen(true);
    }
  }, [mediaGroups]);
  
  const closeViewer = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  const goToNextGroup = useCallback(() => {
    if (hasNext) {
      setCurrentGroupIndex(prev => prev + 1);
      setCurrentIndex(0); // Reset to first image in next group
    }
  }, [hasNext]);
  
  const goToPreviousGroup = useCallback(() => {
    if (hasPrevious) {
      setCurrentGroupIndex(prev => prev - 1);
      setCurrentIndex(0); // Reset to first image in previous group
    }
  }, [hasPrevious]);
  
  return {
    isOpen,
    currentGroup,
    currentIndex,
    hasNext,
    hasPrevious,
    openViewer,
    closeViewer,
    goToNextGroup,
    goToPreviousGroup,
    setCurrentIndex
  };
}
