
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Message } from '@/types/entities/Message'
import { PublicEnhancedMediaDetail } from './PublicEnhancedMediaDetail'

export interface MediaViewerProps {
  isOpen: boolean
  onClose: () => void
  currentGroup: Message[]
  initialIndex?: number
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
  onDelete?: (messageId: string) => Promise<void>
  className?: string
}

export function PublicMediaViewer({
  isOpen,
  onClose,
  currentGroup,
  initialIndex = 0,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  onDelete
}: MediaViewerProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Handle touch gestures for navigation - using useCallback for performance
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }, [])
  
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }, [])
  
  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return
    
    // Determine swipe direction and minimum distance
    const distance = touchStart - touchEnd
    const minSwipeDistance = 50 // Minimum distance to be considered a swipe
    
    if (distance > minSwipeDistance) {
      // Swiped left, go to next
      if (onNext) onNext()
    } else if (distance < -minSwipeDistance) {
      // Swiped right, go to previous
      if (onPrevious) onPrevious()
    }
    
    // Reset touch positions
    setTouchStart(null)
    setTouchEnd(null)
  }, [touchStart, touchEnd, onNext, onPrevious])
  
  // Attach global touch event listeners when the viewer is open
  useEffect(() => {
    const containerElement = containerRef.current
    
    if (isOpen && containerElement) {
      containerElement.addEventListener('touchstart', handleTouchStart as unknown as EventListener)
      containerElement.addEventListener('touchmove', handleTouchMove as unknown as EventListener)
      containerElement.addEventListener('touchend', handleTouchEnd as unknown as EventListener)
      
      return () => {
        containerElement.removeEventListener('touchstart', handleTouchStart as unknown as EventListener)
        containerElement.removeEventListener('touchmove', handleTouchMove as unknown as EventListener)
        containerElement.removeEventListener('touchend', handleTouchEnd as unknown as EventListener)
      }
    }
  }, [isOpen, handleTouchStart, handleTouchMove, handleTouchEnd])
  
  if (!isOpen || currentGroup.length === 0) return null
  
  return (
    <div 
      ref={containerRef}
      className="touch-action-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <PublicEnhancedMediaDetail
        isOpen={isOpen}
        onClose={onClose}
        currentGroup={currentGroup}
        initialIndex={initialIndex}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onDelete={onDelete}
      />
    </div>
  )
}
