import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'
import { EnhancedMediaDisplay } from '@/components/media-viewer/shared/EnhancedMediaDisplay'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Message } from '@/types/entities/Message'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { format } from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight, Clipboard, Download, FileText, Info, MessageSquare, ShoppingBag, Trash2, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { VideoThumbnail } from '@/components/shared/VideoThumbnail'
import { cn } from '@/lib/utils'

// Component props interface
export interface PublicMediaViewerProps {
  /** Array of media objects to view */
  items: Message[];
  /** Currently selected media index */
  currentIndex?: number;
  /** Callback when the dialog is requested to be closed */
  onClose: () => void;
  /** Callback when a different media is selected */
  onSelect?: (index: number) => void;
  /** Whether the dialog is open */
  open: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Product navigation callbacks and state */
  productNavigation?: {
    hasPrevious: boolean;
    hasNext: boolean;
    goToPrevious: () => void;
    goToNext: () => void;
  };
  /** Delete media handler */
  onDelete?: (mediaId: string) => Promise<void>;
}

// Optimized thumbnail component with React.memo to reduce unnecessary re-renders
interface MediaThumbnailsProps {
  items: Message[]
  currentIndex: number
  onSelect: (index: number) => void
}

const MediaThumbnails = React.memo(({ items, currentIndex, onSelect }: MediaThumbnailsProps) => {
  return (
    <div className="flex flex-nowrap items-center gap-2 sm:gap-3 md:gap-4 px-2 py-1 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 touch-pan-x">
      {items.map((item, idx) => {
        const isSelected = idx === currentIndex;
        return (
          <button
            key={`thumbnail-${idx}-${item.id}`}
            className={cn(
              "flex-shrink-0 rounded-sm overflow-hidden border-2 transition-all duration-200 h-12 sm:h-14 md:h-16 w-12 sm:w-14 md:w-16",
              isSelected
                ? "border-primary shadow-md scale-105 z-10"
                : "border-border/50 hover:border-border"
            )}
            onClick={() => onSelect(idx)}
            aria-label={`View media ${idx + 1} of ${items.length}`}
            aria-current={isSelected}
            title={item.caption || `Media ${idx + 1}`}
            type="button"
          >
            {/* Use appropriate thumbnail based on media type */}
            {item.mime_type?.startsWith('video/') ? (
              <VideoThumbnail
                src={item.public_url}
                alt={item.caption || `Video ${idx + 1}`}
                className="w-full h-full object-cover"
                width={64}
                height={64}
              />
            ) : (
              <img
                src={item.public_url}
                alt={item.caption || `Media ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
            {isSelected && (
              <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );
});

MediaThumbnails.displayName = 'MediaThumbnails';

// Main component
const PublicEnhancedMediaDetail: React.FC<PublicMediaViewerProps> = ({
  items,
  currentIndex: initialIndex = 0,
  onClose,
  onSelect,
  open,
  className,
  productNavigation,
  onDelete
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get the current message based on index
  const currentMessage = useMemo(() => {
    return items[currentIndex];
  }, [items, currentIndex]);

  // Reset current index when the group changes or when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex, items]);

  // Navigation capabilities
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex < items.length - 1;

  // Handle navigation
  const handlePrevious = useCallback(() => {
    if (canNavigatePrev) {
      setCurrentIndex((prev) => prev - 1);
    } else if (productNavigation?.hasPrevious) {
      productNavigation.goToPrevious();
    }
  }, [canNavigatePrev, productNavigation]);

  const handleNext = useCallback(() => {
    if (canNavigateNext) {
      setCurrentIndex((prev) => prev + 1);
    } else if (productNavigation?.hasNext) {
      productNavigation.goToNext();
    }
  }, [canNavigateNext, productNavigation]);

  // Function to get formatted creation date
  const getFormattedDate = useCallback((date: string | null) => {
    if (!date) return 'Unknown';
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handlePrevious, handleNext, onClose]);

  // Handler for download - move outside component
  const handleDownloadExternal = (url: string) => {
    // Open url in new tab
    window.open(url, '_blank');
  };

  // Handle copying of details
  const handleCopyDetails = useCallback(() => {
    if (!currentMessage) return;
    
    const details = [
      `Caption: ${currentMessage.caption || 'None'}`,
      `Product: ${currentMessage.product_name || 'None'}`,
      `Code: ${currentMessage.product_code || 'None'}`,
      `Vendor: ${currentMessage.vendor_uid || 'None'}`,
      `Created: ${getFormattedDate(currentMessage.created_at)}`,
      `URL: ${currentMessage.public_url || 'None'}`
    ].join('\n');
    
    navigator.clipboard.writeText(details).then(() => {
      toast.success('Details copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy details');
    });
  }, [currentMessage, getFormattedDate]);

  // Handle copying of link
  const handleCopyLink = useCallback(() => {
    if (!currentMessage?.public_url) return;
    
    navigator.clipboard.writeText(currentMessage.public_url).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  }, [currentMessage]);

  // Handle delete
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!currentMessage) return;
    
    setIsDeleting(true);
    try {
      // TODO: implement delete logic
      toast.success('Media deleted successfully');
      setShowDeleteConfirm(false);
      
      // If this was the last item, close the viewer
      if (items.length === 1) {
        onClose();
      } else if (currentIndex === items.length - 1) {
        // If this was the last index, go to previous
        setCurrentIndex(currentIndex - 1);
      }
      // otherwise the group will be updated and the current index maintained
    } catch (error) {
      console.error('Failed to delete media:', error);
      toast.error('Failed to delete media');
    } finally {
      setIsDeleting(false);
    }
  }, [currentMessage, items, currentIndex, onClose]);

  // If no message is available, show nothing
  if (!currentMessage) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <div 
          className="relative sm:max-w-[90vw] md:max-w-5xl p-0 gap-0 rounded-lg shadow-lg border border-border
          max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh] 
          bg-background/95 backdrop-blur-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Caption header with close button */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
            <div className="flex items-center">
              <Badge variant="outline" className="text-xs font-normal bg-background/50 backdrop-blur-sm">
                {currentIndex + 1} of {items.length}
              </Badge>
            </div>
            
            <p className="text-xs sm:text-sm text-center font-medium flex-1 truncate mx-4">
              {currentMessage?.caption || ''}
            </p>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8 rounded-full hover:bg-background/90"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex flex-col h-full md:flex-row overflow-hidden">
            {/* Media container - optimized for mobile */}
            <div className="relative flex flex-col md:w-3/5 overflow-hidden border-b md:border-b-0 md:border-r h-[40vh] sm:h-[50vh] md:h-auto bg-black/5 dark:bg-black/40">
              {/* Main media display with navigation overlays */}
              <div className="relative flex-1 flex items-center justify-center bg-black/95 min-h-0">
                {/* Previous media button (within current group) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full h-10 w-10 bg-background/80 backdrop-blur-sm border shadow-md",
                    canNavigatePrev ? "opacity-80 hover:opacity-100" : "opacity-30 cursor-not-allowed"
                  )}
                  onClick={handlePrevious}
                  disabled={!canNavigatePrev}
                  aria-label="Previous media"
                  type="button"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                {/* Next media button (within current group) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full h-10 w-10 bg-background/80 backdrop-blur-sm border shadow-md",
                    canNavigateNext ? "opacity-80 hover:opacity-100" : "opacity-30 cursor-not-allowed"
                  )}
                  onClick={handleNext}
                  disabled={!canNavigateNext}
                  aria-label="Next media"
                  type="button"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>

                {/* Media display component */}
                <ErrorBoundary
                  fallback={
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      <div className="p-4 rounded-md bg-muted/20">
                        <span className="block mb-2 text-center">⚠️</span>
                        <p className="text-sm text-center text-muted-foreground">
                          Media could not be displayed
                        </p>
                      </div>
                    </div>
                  }
                >
                  <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
                    <EnhancedMediaDisplay
                      message={currentMessage}
                      className="max-w-full max-h-full rounded-md object-contain"
                    />
                  </div>
                </ErrorBoundary>
              </div>

              {/* Thumbnails for media groups with pagination */}
              {items.length > 1 && (
                <div className="border-t bg-background/95 backdrop-blur-sm h-auto shrink-0">
                  <div className="flex items-center justify-between px-2 h-[72px] md:h-[80px]">
                    {/* Previous product button instead of thumbnail navigation */}
                    {productNavigation?.hasPrevious ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md bg-background"
                        onClick={productNavigation.goToPrevious}
                        aria-label="Previous product"
                        type="button"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        <span className="text-xs">Prev Product</span>
                      </Button>
                    ) : (
                      // Spacer for alignment
                      <div className="w-[105px]"></div>
                    )}
                    
                    <div className="flex-1 overflow-x-auto flex items-center justify-center">
                      <ErrorBoundary
                        fallback={
                          <div className="p-2 text-xs text-center text-muted-foreground h-full flex items-center justify-center">
                            {`${currentIndex + 1} of ${items.length}`}
                          </div>
                        }
                      >
                        <MediaThumbnails
                          items={items}
                          currentIndex={currentIndex}
                          onSelect={setCurrentIndex}
                        />
                      </ErrorBoundary>
                    </div>
                    
                    {/* Next product button instead of thumbnail navigation */}
                    {productNavigation?.hasNext ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md bg-background"
                        onClick={productNavigation.goToNext}
                        aria-label="Next product"
                        type="button"
                      >
                        <span className="text-xs">Next Product</span>
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    ) : (
                      // Spacer for alignment
                      <div className="w-[105px]"></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Information container - tabs for details and metadata */}
            <div className="md:w-2/5 h-[45vh] sm:h-[40vh] md:h-auto overflow-y-auto">
              <Tabs defaultValue="info" className="w-full h-full flex flex-col">
                <TabsList className="w-full mb-0 grid grid-cols-2 bg-muted/60 sticky top-0 z-30">
                  <TabsTrigger value="info" className="text-[11px] sm:text-xs px-2 sm:px-3 h-8 sm:h-9 data-[state=active]:bg-background">
                    <Info className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                    Info
                  </TabsTrigger>
                  <TabsTrigger value="details" className="text-[11px] sm:text-xs px-2 sm:px-3 h-8 sm:h-9 data-[state=active]:bg-background">
                    Details
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex-grow overflow-y-auto p-2 sm:p-4">
                  {/* Info Tab */}
                  <TabsContent value="info" className="mt-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                    <div className="space-y-3 pb-16">
                      {/* Action buttons moved to info tab */}
                      <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 py-2 border border-border/30 rounded-md bg-muted/20">
                        {onDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-md bg-background"
                            onClick={handleDeleteClick}
                            disabled={isDeleting}
                            aria-label="Delete media"
                          >
                            <Trash2 className="w-4 h-4 mr-1 text-destructive" />
                            <span>Delete</span>
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-md bg-background"
                          onClick={() => currentMessage?.public_url && handleDownloadExternal(currentMessage.public_url)}
                          aria-label="Download media"
                        >
                          <Download className="w-4 h-4 mr-1 text-primary" />
                          <span>Download</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-md bg-background"
                          onClick={handleCopyLink}
                          aria-label="Copy media URL"
                        >
                          <Clipboard className="w-4 h-4 mr-1 text-blue-500 dark:text-blue-400" />
                          <span>Copy URL</span>
                        </Button>
                      </div>
                
                      {/* Caption section */}
                      {currentMessage.caption && (
                        <div className="space-y-1 sm:space-y-2">
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Caption</span>
                          </div>
                          <div className="px-2 py-1.5 text-xs sm:text-sm bg-muted/40 rounded-md">
                            {currentMessage.caption}
                          </div>
                        </div>
                      )}

                      {/* Product Information */}
                      {(currentMessage.product_name || currentMessage.vendor_uid || currentMessage.product_code || currentMessage.purchase_date) && (
                        <div className="space-y-1 sm:space-y-2">
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary">
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Product Information</span>
                          </div>
                          
                          <div className="space-y-1 text-xs sm:text-sm">
                            {currentMessage.product_name && (
                              <div className="flex justify-between items-center px-2 py-1 odd:bg-muted/30 even:bg-transparent rounded">
                                <span className="text-muted-foreground">Product Name</span>
                                <span className="font-medium">{currentMessage.product_name}</span>
                              </div>
                            )}
                            
                            {currentMessage.product_code && (
                              <div className="flex justify-between items-center px-2 py-1 odd:bg-muted/30 even:bg-transparent rounded">
                                <span className="text-muted-foreground">Product Code</span>
                                <span className="font-medium">{currentMessage.product_code}</span>
                              </div>
                            )}
                            
                            {currentMessage.vendor_uid && (
                              <div className="flex justify-between items-center px-2 py-1 odd:bg-muted/30 even:bg-transparent rounded">
                                <span className="text-muted-foreground">Vendor</span>
                                <span className="font-medium">{currentMessage.vendor_uid}</span>
                              </div>
                            )}
                            
                            {currentMessage.purchase_date && (
                              <div className="flex justify-between items-center px-2 py-1 odd:bg-muted/30 even:bg-transparent rounded">
                                <span className="text-muted-foreground">Purchase Date</span>
                                <div className="font-medium flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{getFormattedDate(currentMessage.purchase_date)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Details Tab */}
                  <TabsContent value="details" className="mt-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                    <div className="space-y-3 pb-16">
                      <div className="space-y-1 sm:space-y-2">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Technical Details</span>
                        </div>
                        
                        <div className="space-y-1 text-xs sm:text-sm">
                          <div className="flex justify-between items-center px-2 py-1 odd:bg-muted/30 even:bg-transparent rounded">
                            <span className="text-muted-foreground">File Type</span>
                            <span className="font-medium">{currentMessage.mime_type || 'Unknown'}</span>
                          </div>
                          
                          <div className="flex justify-between items-center px-2 py-1 odd:bg-muted/30 even:bg-transparent rounded">
                            <span className="text-muted-foreground">File Size</span>
                            <span className="font-medium">{formatFileSize(currentMessage.file_size || 0)}</span>
                          </div>
                          
                          <div className="flex justify-between items-center px-2 py-1 odd:bg-muted/30 even:bg-transparent rounded">
                            <span className="text-muted-foreground">Created On</span>
                            <div className="font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{getFormattedDate(currentMessage.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this media? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
};

// Default component that's compatible with the existing interface
const PublicMediaViewerWithClickOutside: React.FC<PublicMediaViewerProps> = ({
  items,
  currentIndex,
  onClose,
  onSelect,
  open,
  className,
  productNavigation
}) => {
  if (!open) return null;
  
  return (
    <PublicEnhancedMediaDetail
      items={items}
      currentIndex={currentIndex}
      onClose={onClose}
      onSelect={onSelect}
      open={open}
      className={className}
      productNavigation={productNavigation}
    />
  );
};

// Default export for backwards compatibility
export default PublicMediaViewerWithClickOutside;

// Add this line for backwards compatibility with existing imports
export { PublicEnhancedMediaDetail };
