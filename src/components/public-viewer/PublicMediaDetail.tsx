
import React, { useState, useEffect, useCallback } from 'react'
import { Message } from '@/types/entities/Message'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Pencil, 
  Trash2, 
  ExternalLink,
  Download,
  Image,
  Video
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MediaDisplay } from '@/components/media-viewer/shared/MediaDisplay'
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
import { useTelegramOperations } from '@/hooks/useTelegramOperations'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { isVideoMessage } from '@/utils/mediaUtils'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'

interface PublicMediaDetailProps {
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

export function PublicMediaDetail({
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
}: PublicMediaDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteFromTelegram, setDeleteFromTelegram] = useState(false)
  const { handleDelete, isProcessing } = useTelegramOperations()
  
  const currentMessage = currentGroup[currentIndex]
  
  // Reset current index when group changes and ensure consistent media ordering
  useEffect(() => {
    setCurrentIndex(initialIndex)
    
    // Reset delete state when group changes
    setIsDeleteDialogOpen(false)
    setDeleteFromTelegram(false)
  }, [currentGroup, initialIndex])
  
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      // Smooth transition to previous item in group
      setCurrentIndex(prev => prev - 1)
    } else if (onPrevious) {
      // If at the beginning of current group, go to previous group
      onPrevious()
    }
  }, [currentIndex, onPrevious])
  
  const handleNext = useCallback(() => {
    if (currentIndex < currentGroup.length - 1) {
      // Smooth transition to next item in group
      setCurrentIndex(prev => prev + 1)
    } else if (onNext) {
      // If at the end of current group, go to next group
      onNext()
    }
  }, [currentIndex, currentGroup.length, onNext])
  
  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true)
  }, [])
  
  const handleDeleteConfirm = useCallback(async () => {
    if (!currentMessage) return
    
    try {
      await handleDelete(currentMessage, deleteFromTelegram)
      
      // If there's an external onDelete handler, call it
      if (onDelete) {
        await onDelete(currentMessage.id)
      }
      
      setIsDeleteDialogOpen(false)
      
      // If this was the last item in the group, close the viewer
      if (currentGroup.length <= 1) {
        onClose()
      } else {
        // Otherwise go to the next or previous item
        if (currentIndex === currentGroup.length - 1) {
          // Move to previous when at the end
          setCurrentIndex(prev => Math.max(0, prev - 1))
        } else {
          // Otherwise move to next
          setCurrentIndex(prev => Math.min(currentGroup.length - 1, prev + 1))
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }, [currentMessage, deleteFromTelegram, handleDelete, onDelete, currentGroup.length, onClose, currentIndex])
  
  const openTelegramLink = () => {
    const chatId = currentMessage?.chat_id?.toString().replace('-100', '')
    const messageId = currentMessage?.telegram_message_id
    
    if (chatId && messageId) {
      window.open(`https://t.me/c/${chatId}/${messageId}`, '_blank')
    }
  }

  const handleDownload = () => {
    if (currentMessage?.public_url) {
      // Create an anchor element and trigger download
      const a = document.createElement('a')
      a.href = currentMessage.public_url
      a.download = `media-${currentMessage.id}${getFileExtension(currentMessage)}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const getFileExtension = (message: Message) => {
    if (!message.mime_type) return '';
    
    if (message.mime_type.startsWith('image/')) {
      const format = message.mime_type.split('/')[1];
      return format === 'jpeg' ? '.jpg' : `.${format}`;
    }
    
    if (message.mime_type.startsWith('video/')) {
      return `.${message.mime_type.split('/')[1]}`;
    }
    
    return '';
  }
  
  // Handle keyboard navigation with enhanced features
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard navigation if the user is typing in a form field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious()
          break
        case 'ArrowRight':
          handleNext()
          break
        case 'Escape':
          onClose()
          break
        case 'Home':
          // Go to first item in group
          setCurrentIndex(0)
          break
        case 'End':
          // Go to last item in group
          setCurrentIndex(currentGroup.length - 1)
          break
        case 'Delete':
          // Open delete dialog
          if (!isDeleteDialogOpen) {
            handleDeleteClick()
          }
          break
        default:
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleNext, handlePrevious, onClose, currentGroup.length, handleDeleteClick, isDeleteDialogOpen])
  
  if (!currentMessage) return null
  
  const canNavigatePrev = currentIndex > 0 || !!hasPrevious
  const canNavigateNext = currentIndex < currentGroup.length - 1 || !!hasNext
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-6xl p-0 gap-0 max-h-[90vh] overflow-hidden">
          <DialogTitle>
            <VisuallyHidden>Media Details</VisuallyHidden>
          </DialogTitle>
          {/* Desktop: Two-column layout with details on left, media on right */}
          <div className="grid grid-cols-1 md:grid-cols-2 h-full">
            {/* Left column - Details Panel */}
            <div className="bg-background/95 backdrop-blur-md overflow-y-auto max-h-[90vh] border-r">
              <div className="p-4 border-b flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <h2 className="text-lg font-medium">Media Details</h2>
                  {currentMessage.product_name && (
                    <span className="text-sm text-muted-foreground">
                      ({currentMessage.product_name})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDeleteClick}
                    className="flex items-center gap-1 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
              
              {/* Metadata Section */}
              <div className="p-4 space-y-4">
                {currentMessage?.caption && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Caption</h3>
                    <p className="text-sm whitespace-pre-line bg-background/20 p-3 rounded-md max-h-48 overflow-y-auto">
                      {currentMessage.caption}
                    </p>
                  </div>
                )}
                
                <div className="space-y-3">
                  {currentMessage.mime_type && (
                    <Badge variant="outline" className="mb-2">
                      {currentMessage.mime_type.startsWith('image/') ? (
                        <><Image className="h-3 w-3 mr-1" /> Image</>
                      ) : currentMessage.mime_type.startsWith('video/') ? (
                        <><Video className="h-3 w-3 mr-1" /> Video</>
                      ) : (
                        currentMessage.mime_type
                      )}
                    </Badge>
                  )}
                  
                  {currentMessage.product_name && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs font-medium text-muted-foreground">Product:</div>
                      <div className="text-xs col-span-2">{currentMessage.product_name}</div>
                    </div>
                  )}
                  
                  {currentMessage.vendor_uid && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs font-medium text-muted-foreground">Vendor:</div>
                      <div className="text-xs col-span-2">{currentMessage.vendor_uid}</div>
                    </div>
                  )}
                  
                  {currentMessage.purchase_date && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs font-medium text-muted-foreground">Purchase Date:</div>
                      <div className="text-xs col-span-2">
                        {format(new Date(currentMessage.purchase_date), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  )}
                  
                  {currentMessage.created_at && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs font-medium text-muted-foreground">Added:</div>
                      <div className="text-xs col-span-2">
                        {format(new Date(currentMessage.created_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  )}
                  
                  {currentMessage.file_size && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs font-medium text-muted-foreground">Size:</div>
                      <div className="text-xs col-span-2">
                        {Math.round(currentMessage.file_size / 1024)} KB
                      </div>
                    </div>
                  )}
                  
                  {(currentMessage.width && currentMessage.height) && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs font-medium text-muted-foreground">Dimensions:</div>
                      <div className="text-xs col-span-2">
                        {currentMessage.width} × {currentMessage.height}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDownload}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </Button>
                  
                  {currentMessage.chat_id && currentMessage.telegram_message_id && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={openTelegramLink}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Telegram</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right column - Media Display */}
            <div className="bg-black/70 flex flex-col relative">
              {/* Previous/Next Group Controls */}
              {canNavigatePrev && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              )}
              
              {canNavigateNext && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              )}
              
              {/* Media Display wrapped in ErrorBoundary */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                <ErrorBoundary
                  fallback={
                    <div className="flex flex-col items-center justify-center w-full h-full rounded-md bg-muted/20">
                      <div className="text-3xl mb-4">🖼️</div>
                      <div className="text-muted-foreground text-center">
                        <p>Unable to display this media</p>
                        <p className="text-sm mt-1 text-muted-foreground/70">{currentMessage.mime_type || 'Unknown media type'}</p>
                      </div>
                    </div>
                  }
                >
                  <MediaDisplay message={currentMessage} />
                </ErrorBoundary>
              </div>
              
              {/* Enhanced thumbnails for media groups */}
              {currentGroup.length > 1 && (
                <div className="p-2 bg-background/20 shrink-0">
                  <ErrorBoundary
                    fallback={
                      <div className="text-center text-xs text-muted-foreground p-2">
                        {`${currentIndex + 1} of ${currentGroup.length}`}
                      </div>
                    }
                  >
                    <div className="flex justify-center w-full gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent p-1">
                    {currentGroup.map((item, idx) => {
                      const isImage = item.mime_type?.startsWith('image/');
                      const isVideo = isVideoMessage(item) || 
                        (item.public_url && [".mp4", ".mov", ".webm", ".avi"].some(ext => item.public_url?.endsWith(ext)));
                      
                      return (
                        <button
                          key={item.id}
                          className={cn(
                            "relative flex-shrink-0 h-14 w-14 rounded-md overflow-hidden transition-all border-2",
                            idx === currentIndex 
                              ? "border-primary ring-2 ring-primary ring-opacity-50" 
                              : "border-transparent hover:border-primary/50"
                          )}
                          onClick={() => setCurrentIndex(idx)}
                          aria-label={`View item ${idx + 1} of ${currentGroup.length}`}
                        >
                          {/* Show thumbnail image with fallback */}
                          <img 
                            src={item.public_url} 
                            alt={`Thumbnail ${idx + 1}`} 
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              // Hide the broken image and show media type icon as fallback
                              e.currentTarget.style.opacity = '0.3';
                              
                              // Add fallback placeholder background
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.classList.add('bg-muted');
                              }
                            }}
                          />
                          
                          {/* Overlay icon to indicate media type */}
                          <div className="absolute bottom-0 right-0 bg-black/60 p-0.5 rounded-tl-sm">
                            {isVideo ? (
                              <Video className="h-3 w-3 text-white" />
                            ) : isImage ? (
                              <Image className="h-3 w-3 text-white" />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </ErrorBoundary>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to delete this media item? You can choose to:
              <div className="mt-4 space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="delete-telegram"
                    checked={deleteFromTelegram}
                    onCheckedChange={(checked) => setDeleteFromTelegram(checked === true)}
                  />
                  <label htmlFor="delete-telegram" className="text-sm font-medium">
                    Also delete from Telegram (permanent)
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
