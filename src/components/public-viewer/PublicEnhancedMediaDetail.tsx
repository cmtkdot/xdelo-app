import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Message } from '@/types/entities/Message'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Hash, MessageSquare, Download, Trash2, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react'
import { format } from 'date-fns'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'
import { EnhancedMediaDisplay } from '@/components/media-viewer/shared/EnhancedMediaDisplay'

// Component props interface
export interface PublicEnhancedMediaDetailProps {
  isOpen: boolean
  onClose: () => void
  currentGroup: Message[]
  initialIndex?: number
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
  onDelete?: (messageId: string) => Promise<void>
}

// Optimized thumbnail component with React.memo to reduce unnecessary re-renders
interface MediaThumbnailsProps {
  items: Message[]
  currentIndex: number
  onSelect: (index: number) => void
}

const MediaThumbnails = React.memo(({ items, currentIndex, onSelect }: MediaThumbnailsProps) => {
  return (
    <div className="flex overflow-x-auto overscroll-x-contain gap-1 justify-center p-1 w-full sm:gap-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent touch-pan-x">
      {items.map((item, idx) => {
        const isActive = idx === currentIndex;
        return (
          <button
            key={item.id}
            className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 relative rounded-md overflow-hidden border-2 transition-all ${
              isActive ? 'border-primary scale-105 shadow-md z-10' : 'border-transparent opacity-80 hover:opacity-100'
            }`}
            onClick={() => onSelect(idx)}
            aria-label={`View media ${idx + 1} of ${items.length}`}
            aria-current={isActive ? 'true' : 'false'}
          >
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              {/* Simple thumbnail component optimized for performance */}
              <div className="w-full h-full">
                <img
                  src={item.public_url || '/placeholder-image.svg'}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex justify-center">
              <span className="text-[10px] bg-black/60 text-white px-1 rounded-sm">
                {idx + 1}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
});

MediaThumbnails.displayName = 'MediaThumbnails';

export function PublicEnhancedMediaDetail({
  isOpen,
  onClose,
  currentGroup,
  initialIndex = 0,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  onDelete,
}: PublicEnhancedMediaDetailProps) {
  // State management
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get the current message from the group based on the index
  const currentMessage = useMemo(() => {
    if (currentGroup && currentGroup.length > 0) {
      return currentGroup[currentIndex] || currentGroup[0];
    }
    return null;
  }, [currentGroup, currentIndex]);

  // Reset current index when the group changes
  useEffect(() => {
    if (initialIndex !== undefined && initialIndex >= 0 && initialIndex < currentGroup.length) {
      setCurrentIndex(initialIndex);
    } else {
      setCurrentIndex(0);
    }
  }, [currentGroup, initialIndex]);

  // Navigation logic
  const canNavigatePrev = useMemo(() => {
    // Either we have previous media in this group, or we have an onPrevious handler for inter-group navigation
    return (currentIndex > 0) || (currentIndex === 0 && !!onPrevious && hasPrevious);
  }, [currentIndex, onPrevious, hasPrevious]);

  const canNavigateNext = useMemo(() => {
    // Either we have more media in this group, or we have an onNext handler for inter-group navigation
    return (currentIndex < currentGroup.length - 1) || (currentIndex === currentGroup.length - 1 && !!onNext && hasNext);
  }, [currentIndex, currentGroup, onNext, hasNext]);

  // Handle previous/next navigation with keyboard and touch events
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      // Navigate within this group
      setCurrentIndex(prevIndex => prevIndex - 1);
    } else if (onPrevious && hasPrevious) {
      // Navigate to previous group
      onPrevious();
    }
  }, [currentIndex, onPrevious, hasPrevious]);

  const handleNext = useCallback(() => {
    if (currentIndex < currentGroup.length - 1) {
      // Navigate within this group
      setCurrentIndex(prevIndex => prevIndex + 1);
    } else if (onNext && hasNext) {
      // Navigate to next group
      onNext();
    }
  }, [currentIndex, currentGroup, onNext, hasNext]);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowLeft' && canNavigatePrev) {
        handlePrevious();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' && canNavigateNext) {
        handleNext();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, canNavigatePrev, canNavigateNext, handlePrevious, handleNext, onClose]);

  // Download the current media
  const handleDownload = useCallback(() => {
    if (!currentMessage || !currentMessage.public_url) return;
    
    const a = document.createElement('a');
    a.href = currentMessage.public_url;
    const extension = currentMessage.mime_type ? 
      `.${currentMessage.mime_type.split('/')[1] || 'jpg'}` : '.jpg';
    a.download = `${currentMessage.file_unique_id || 'media'}${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [currentMessage]);

  // Delete the current media
  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!currentMessage || !onDelete) return;
    
    try {
      setIsDeleting(true);
      await onDelete(currentMessage.id);
      setIsDeleteDialogOpen(false);
      
      // If we deleted the last item in the group, close the dialog
      if (currentGroup.length === 1) {
        onClose();
      } else {
        // Otherwise, navigate to the previous item or the next one if we're at the beginning
        if (currentIndex > 0) {
          setCurrentIndex(prevIndex => prevIndex - 1);
        } else if (currentIndex < currentGroup.length - 1) {
          setCurrentIndex(prevIndex => prevIndex + 1);
        }
      }
    } catch (error) {
      console.error('Failed to delete media:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [currentMessage, onDelete, currentGroup, currentIndex, onClose]);

  // If no message is available, show nothing
  if (!currentMessage) return null;
  
  // Get analyzed content values safely
  const vendorName = currentMessage.analyzed_content?.vendor_uid || '';
  const purchasePrice = currentMessage.analyzed_content?.unit_price || 
                       currentMessage.analyzed_content?.total_price || '';
  const purchaseDate = currentMessage.analyzed_content?.purchase_date || '';
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        {/* Use the shadcn Dialog with a modern dark overlay */}
        <DialogContent className="sm:max-w-[95vw] md:max-w-6xl p-0 gap-0 max-h-[90vh] w-full h-full overflow-hidden">
          <DialogTitle>
            <VisuallyHidden>Media Details</VisuallyHidden>
          </DialogTitle>
          {/* Responsive layout: stacked on mobile, side-by-side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 h-full max-h-[90vh] overflow-hidden">
            {/* Details Panel - Full width on mobile, left column on desktop */}
            <div className="bg-background/95 backdrop-blur-md overflow-y-auto order-2 md:order-1 max-h-[30vh] md:max-h-[90vh] border-t md:border-t-0 md:border-r">
              <div className="p-2 sm:p-4 border-b flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <h2 className="text-base sm:text-lg font-medium">Media Details</h2>
                  {currentMessage.product_name && (
                    <span className="text-sm text-muted-foreground">
                      {currentMessage.product_name}
                    </span>
                  )}
                </div>
                
                {onDelete && (
                  <Button
                    variant="ghost" 
                    size="sm"
                    onClick={handleDeleteClick}
                    className="flex items-center gap-1 text-destructive h-8 w-8 sm:w-auto sm:h-9 sm:px-3"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs sm:text-sm">Delete</span>
                  </Button>
                )}
              </div>
              
              {/* Media display - Full width on mobile, right column on desktop */}
              <div className="flex-1 flex flex-col overflow-hidden order-1 md:order-2">
                {/* Media navigation controls */}
                {canNavigatePrev && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50 hover:bg-background/70 transition-colors touch-action-none"
                    onClick={handlePrevious}
                    aria-label="Previous media"
                  >
                    <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                  </Button>
                )}
                
                {canNavigateNext && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50 hover:bg-background/70 transition-colors touch-action-none"
                    onClick={handleNext}
                    aria-label="Next media"
                  >
                    <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                  </Button>
                )}
                <div className="relative flex-1 flex items-center justify-center bg-black/90 p-1 sm:p-2 md:p-4 overflow-hidden">
                  <ErrorBoundary
                    fallback={
                      <div className="flex flex-col items-center justify-center h-full w-full">
                        <div className="bg-muted/20 p-4 rounded-md">
                          <span className="block text-center mb-2">⚠️</span>
                          <p className="text-sm text-muted-foreground text-center">
                            {`Media ${currentIndex + 1} of ${currentGroup.length} could not be displayed`}
                          </p>
                        </div>
                      </div>
                    }
                  >
                    <EnhancedMediaDisplay 
                      message={currentMessage}
                      className="w-full h-full rounded-md"
                    />
                  </ErrorBoundary>
                </div>
                
                {/* Thumbnails for media groups */}
                {currentGroup.length > 1 && (
                  <div className="p-1 sm:p-2 bg-background/30 backdrop-blur-sm border-t border-border/10 shrink-0">
                    <ErrorBoundary
                      fallback={
                        <div className="text-center text-xs text-muted-foreground p-2">
                          {`${currentIndex + 1} of ${currentGroup.length}`}
                        </div>
                      }
                    >
                      {/* Thumbnail navigation - optimized to minimize renders */}
                      <MediaThumbnails 
                        items={currentGroup}
                        currentIndex={currentIndex}
                        onSelect={setCurrentIndex}
                      />
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            </div>
            
            {/* Metadata Section */}
            <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
              {/* Caption section with card styling */}
              {currentMessage.caption && (
                <div className="bg-muted/40 rounded-lg p-3 border border-border/5">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-primary/70" />
                    <span>Caption</span>
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{currentMessage.caption}</p>
                </div>
              )}
              
              {/* Product information with card styling */}
              {(
                currentMessage.product_name || 
                vendorName ||
                purchasePrice ||
                purchaseDate
              ) && (
                <div className="bg-muted/40 rounded-lg p-3 border border-border/5">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5 text-primary/70" />
                    <span>Product Info</span>
                  </h3>
                  <div className="space-y-2">
                    {currentMessage.product_name && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Product</span>
                        <span className="font-medium">{currentMessage.product_name}</span>
                      </div>
                    )}
                    
                    {vendorName && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Vendor</span>
                        <span className="font-medium">{vendorName}</span>
                      </div>
                    )}
                    
                    {purchasePrice && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Price</span>
                        <Badge variant="outline" className="font-medium">
                          ${purchasePrice}
                        </Badge>
                      </div>
                    )}
                    
                    {purchaseDate && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Purchase Date</span>
                        <span className="font-medium">
                          {format(new Date(purchaseDate), 'PP')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* File information section with modern card styling */}
              <div className="bg-muted/40 rounded-lg p-3 border border-border/5">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary/70" />
                  <span>File Info</span>
                </h3>
                <div className="space-y-2">
                  {currentMessage.mime_type && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{currentMessage.mime_type}</span>
                    </div>
                  )}
                  
                  {currentMessage.file_size && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Size</span>
                      <Badge variant="outline" className="font-medium">
                        {(currentMessage.file_size / (1024 * 1024)).toFixed(2)} MB
                      </Badge>
                    </div>
                  )}
                  
                  {currentMessage.telegram_message_id && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Message ID</span>
                      <span className="truncate max-w-[160px] font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {currentMessage.telegram_message_id}
                      </span>
                    </div>
                  )}
                  
                  {currentMessage.media_group_id && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Group</span>
                      <span className="truncate max-w-[160px] font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {currentMessage.media_group_id}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Tags section with modern styling - removed since tags property doesn't exist on Message */}
              
              <div className="flex flex-wrap gap-2 pt-2">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this media?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The media will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
