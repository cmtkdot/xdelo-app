
import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';

export function usePublicViewer(mediaGroups: Message[][]) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Message[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [initialIndex, setInitialIndex] = useState(0);

  // Open the viewer with a specific group and optional index
  const openViewer = useCallback((group: Message[], index: number = 0) => {
    setCurrentGroup(group);
    setInitialIndex(index);
    setCurrentGroupIndex(mediaGroups.findIndex(g => g[0]?.id === group[0]?.id));
    setIsOpen(true);
  }, [mediaGroups]);

  // Close the viewer
  const closeViewer = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Navigate to the next group
  const goToNextGroup = useCallback(() => {
    if (currentGroupIndex < mediaGroups.length - 1) {
      const nextGroup = mediaGroups[currentGroupIndex + 1];
      setCurrentGroup(nextGroup);
      setCurrentGroupIndex(prev => prev + 1);
      setInitialIndex(0);
    }
  }, [currentGroupIndex, mediaGroups]);

  // Navigate to the previous group
  const goToPreviousGroup = useCallback(() => {
    if (currentGroupIndex > 0) {
      const prevGroup = mediaGroups[currentGroupIndex - 1];
      setCurrentGroup(prevGroup);
      setCurrentGroupIndex(prev => prev - 1);
      setInitialIndex(0);
    }
  }, [currentGroupIndex, mediaGroups]);

  // Check if we have next/previous groups
  const hasNext = currentGroupIndex < mediaGroups.length - 1;
  const hasPrevious = currentGroupIndex > 0;

  return {
    isOpen,
    currentGroup,
    currentGroupIndex,
    initialIndex,
    hasNext,
    hasPrevious,
    openViewer,
    closeViewer,
    goToNextGroup,
    goToPreviousGroup
  };
}
