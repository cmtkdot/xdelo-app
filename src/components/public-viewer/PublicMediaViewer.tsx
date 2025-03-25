import React, { useState, useEffect, useRef } from 'react'
import { Message } from '@/types/entities/Message'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Info, 
  Database, 
  Send
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useTelegramOperations } from '@/hooks/useTelegramOperations'
import { PublicMediaDetail } from './PublicMediaDetail'

interface PublicMediaViewerProps {
  isOpen: boolean
  onClose: () => void
  currentGroup: Message[]
  initialIndex?: number
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
  onEdit?: (message: Message, newCaption: string) => Promise<void>
  onDelete?: (messageId: string) => Promise<void>
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
  onEdit,
  onDelete,
}: PublicMediaViewerProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Handle touch gestures for navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const handleTouchEnd = () => {
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
  }
  
  // Attach global touch event listeners when the viewer is open
  useEffect(() => {
    const containerElement = containerRef.current
    
    if (isOpen && containerElement) {
      containerElement.addEventListener('touchstart', handleTouchStart as any)
      containerElement.addEventListener('touchmove', handleTouchMove as any)
      containerElement.addEventListener('touchend', handleTouchEnd as any)
      
      return () => {
        containerElement.removeEventListener('touchstart', handleTouchStart as any)
        containerElement.removeEventListener('touchmove', handleTouchMove as any)
        containerElement.removeEventListener('touchend', handleTouchEnd as any)
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
      <PublicMediaDetail
        isOpen={isOpen}
        onClose={onClose}
        currentGroup={currentGroup}
        initialIndex={initialIndex}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
} 