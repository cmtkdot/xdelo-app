import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'
import { EnhancedMediaDisplay } from '@/components/media-viewer/shared/EnhancedMediaDisplay'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Message } from '@/types/entities/Message'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { format } from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight, Clipboard, Download, FileText, Info, MessageSquare, ShoppingBag, Trash2, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

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
    <div className="flex items-center justify-start w-full gap-1 p-1 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 touch-pan-x sm:gap-2">
      {items.map((item, idx) => {
        const isActive = idx === currentIndex;
        const hasImage = Boolean(item.public_url && item.mime_type?.startsWith('image/'));
        
        return (
          <button
            key={item.id}
            className={`relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden border-2 transition-all
              ${isActive ? 'border-primary scale-105 shadow-md z-10' : 'border-transparent opacity-80 hover:opacity-100'}`}
            onClick={() => onSelect(idx)}
            aria-label={`View media ${idx + 1} of ${items.length}`}
            aria-current={isActive ? 'true' : 'false'}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              {hasImage ? (
                <img
                  src={item.public_url}
                  alt={item.caption || `Media ${idx + 1}`}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-muted-foreground/10">
                  <FileText className="w-6 h-6 text-muted-foreground/50" />
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center p-0.5 text-[10px] font-medium bg-black/50 text-white">
                {idx + 1}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

MediaThumbnails.displayName = 'MediaThumbnails';

// Main component
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
  // Internal state
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("media");

  // Update current index if initialIndex prop changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Ensure currentIndex is within bounds when currentGroup changes
  useEffect(() => {
    if (currentIndex >= currentGroup.length) {
      setCurrentIndex(Math.max(0, currentGroup.length - 1));
    }
  }, [currentGroup, currentIndex]);

  // Get current message
  const currentMessage = useMemo(() => {
    return currentGroup[currentIndex] || null;
  }, [currentGroup, currentIndex]);

  // Navigation flags
  const canNavigateNext = useMemo(() => {
    return currentIndex < currentGroup.length - 1 || hasNext;
  }, [currentIndex, currentGroup, hasNext]);

  const canNavigatePrev = useMemo(() => {
    return currentIndex > 0 || hasPrevious;
  }, [currentIndex, hasPrevious]);

  // Handle next/previous navigation
  const handleNext = useCallback(() => {
    if (currentIndex < currentGroup.length - 1) {
      setCurrentIndex(prevIndex => prevIndex + 1);
    } else if (onNext) {
      onNext();
    }
  }, [currentIndex, currentGroup, onNext]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prevIndex => prevIndex - 1);
    } else if (onPrevious) {
      onPrevious();
    }
  }, [currentIndex, onPrevious]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowRight':
          if (canNavigateNext) handleNext();
          break;
        case 'ArrowLeft':
          if (canNavigatePrev) handlePrevious();
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canNavigateNext, canNavigatePrev, handleNext, handlePrevious, onClose]);

  // Handlers
  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDownload = useCallback(() => {
    if (!currentMessage?.public_url) return;
    
    try {
      const link = document.createElement('a');
      link.href = currentMessage.public_url;
      // Extract filename from URL or use message ID
      const fileName = currentMessage.public_url.split('/').pop() || 
                       `media-${currentMessage.id}.${currentMessage.mime_type?.split('/')[1] || 'file'}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
      toast.error('Failed to download file');
    }
  }, [currentMessage]);

  const handleCopyDetails = useCallback(() => {
    if (!currentMessage) return;

    try {
      const details = [
        currentMessage.product_name && `Product: ${currentMessage.product_name}`,
        currentMessage.product_code && `Code: ${currentMessage.product_code}`,
        currentMessage.vendor_uid && `Vendor: ${currentMessage.vendor_uid}`,
        currentMessage.purchase_date && `Purchase: ${format(new Date(currentMessage.purchase_date), 'PP')}`,
        currentMessage.caption && `\n${currentMessage.caption}`
      ].filter(Boolean).join('\n');

      navigator.clipboard.writeText(details);
      toast.success('Details copied to clipboard');
    } catch (error) {
      console.error('Failed to copy details:', error);
      toast.error('Failed to copy details');
    }
  }, [currentMessage]);

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
      toast.error('Failed to delete media');
    } finally {
      setIsDeleting(false);
    }
  }, [currentMessage, onDelete, currentGroup, currentIndex, onClose]);

  // If no message is available, show nothing
  if (!currentMessage) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[calc(100vw-32px)] md:max-w-5xl p-0 gap-0 max-h-[85vh] overflow-hidden">
          <div className="flex flex-col h-full md:flex-row md:min-h-[600px]">
            {/* Media container */}
            <div className="relative flex flex-col flex-1 md:w-3/5 md:h-[85vh] overflow-hidden border-b md:border-b-0 md:border-r">
              {/* Close button in top-right corner */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-2 z-30 w-8 h-8 rounded-full bg-background/50 hover:bg-background/70"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </Button>
              
              {/* Media display area */}
              <div className="relative flex items-center justify-center flex-1 bg-black/90">
                {/* Navigation buttons */}
                {canNavigatePrev && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute z-20 transition-colors transform -translate-y-1/2 rounded-full left-2 top-1/2 bg-background/50 hover:bg-background/70"
                    onClick={handlePrevious}
                    aria-label="Previous media"
                  >
                    <ChevronLeft className="w-5 h-5 sm:h-6 sm:w-6" />
                  </Button>
                )}

                {canNavigateNext && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute z-20 transition-colors transform -translate-y-1/2 rounded-full right-2 top-1/2 bg-background/50 hover:bg-background/70"
                    onClick={handleNext}
                    aria-label="Next media"
                  >
                    <ChevronRight className="w-5 h-5 sm:h-6 sm:w-6" />
                  </Button>
                )}

                {/* Media display with error boundary */}
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
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <EnhancedMediaDisplay
                      message={currentMessage}
                      className="max-w-full max-h-full rounded-md object-contain"
                    />
                  </div>
                </ErrorBoundary>
              </div>

              {/* Thumbnails for media groups */}
              {currentGroup.length > 1 && (
                <div className="p-2 border-t bg-background/95 backdrop-blur-sm shrink-0">
                  <ErrorBoundary
                    fallback={
                      <div className="p-2 text-xs text-center text-muted-foreground">
                        {`${currentIndex + 1} of ${currentGroup.length}`}
                      </div>
                    }
                  >
                    <MediaThumbnails
                      items={currentGroup}
                      currentIndex={currentIndex}
                      onSelect={setCurrentIndex}
                    />
                  </ErrorBoundary>
                </div>
              )}
            </div>

            {/* Details panel */}
            <div className="w-full md:w-2/5 h-full overflow-y-auto flex flex-col bg-background">
              {/* Header with counter and actions */}
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-normal">
                    {currentIndex + 1} of {currentGroup.length}
                  </Badge>
                  {currentMessage.mime_type && (
                    <Badge variant="secondary" className="text-xs">
                      {currentMessage.mime_type.split('/')[0]}
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-1">
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteClick}
                      className="text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                    <span className="sr-only">Download</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyDetails}
                    className="h-8 w-8 p-0"
                  >
                    <Clipboard className="h-4 w-4" />
                    <span className="sr-only">Copy Details</span>
                  </Button>
                </div>
              </div>

              {/* Tabs for mobile */}
              <div className="p-4 overflow-y-auto">
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="w-full mb-4 grid grid-cols-3">
                    <TabsTrigger value="info" className="text-xs">
                      <Info className="w-3 h-3 mr-1" /> Info
                    </TabsTrigger>
                    <TabsTrigger value="product" className="text-xs">
                      <ShoppingBag className="w-3 h-3 mr-1" /> Product
                    </TabsTrigger>
                    <TabsTrigger value="details" className="text-xs">
                      <FileText className="w-3 h-3 mr-1" /> Details
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Info Tab - Basic Details */}
                  <TabsContent value="info" className="space-y-4 mt-0">
                    {/* Caption section */}
                    {currentMessage.caption && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <MessageSquare className="h-3.5 w-3.5 text-primary" />
                          <span>Caption</span>
                        </div>
                        <div className="p-3 rounded-md bg-muted/30 border text-sm">
                          <p className="whitespace-pre-wrap">{currentMessage.caption}</p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Product Tab - Product Information */}
                  <TabsContent value="product" className="space-y-4 mt-0">
                    {currentMessage.product_name || currentMessage.vendor_uid || currentMessage.product_code || currentMessage.purchase_date ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                          <span>Product Information</span>
                        </div>
                        <div className="rounded-md bg-muted/30 border divide-y">
                          {currentMessage.product_name && (
                            <div className="px-3 py-2 flex justify-between">
                              <span className="text-xs text-muted-foreground">Product Name</span>
                              <span className="text-sm font-medium">{currentMessage.product_name}</span>
                            </div>
                          )}
                          
                          {currentMessage.product_code && (
                            <div className="px-3 py-2 flex justify-between">
                              <span className="text-xs text-muted-foreground">Product Code</span>
                              <span className="text-sm font-medium">{currentMessage.product_code}</span>
                            </div>
                          )}
                          
                          {currentMessage.vendor_uid && (
                            <div className="px-3 py-2 flex justify-between">
                              <span className="text-xs text-muted-foreground">Vendor</span>
                              <span className="text-sm font-medium">{currentMessage.vendor_uid}</span>
                            </div>
                          )}
                          
                          {currentMessage.purchase_date && (
                            <div className="px-3 py-2 flex justify-between">
                              <span className="text-xs text-muted-foreground">Purchase Date</span>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {format(new Date(currentMessage.purchase_date), 'PP')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-center text-muted-foreground py-4">
                        No product information available
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Details Tab - Technical Details */}
                  <TabsContent value="details" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span>File Information</span>
                      </div>
                      <div className="rounded-md bg-muted/30 border divide-y">
                        {currentMessage.public_url && (
                          <div className="px-3 py-2 flex justify-between">
                            <span className="text-xs text-muted-foreground">Filename</span>
                            <span className="text-sm font-medium truncate max-w-[180px]">
                              {currentMessage.public_url.split('/').pop() || 'Unknown'}
                            </span>
                          </div>
                        )}
                      
                        {currentMessage.mime_type && (
                          <div className="px-3 py-2 flex justify-between">
                            <span className="text-xs text-muted-foreground">MIME Type</span>
                            <span className="text-sm font-medium">{currentMessage.mime_type}</span>
                          </div>
                        )}
                        
                        {currentMessage.file_size && (
                          <div className="px-3 py-2 flex justify-between">
                            <span className="text-xs text-muted-foreground">File Size</span>
                            <Badge variant="outline" className="text-xs font-normal">
                              {(currentMessage.file_size / (1024 * 1024)).toFixed(2)} MB
                            </Badge>
                          </div>
                        )}
                        
                        {currentMessage.created_at && (
                          <div className="px-3 py-2 flex justify-between">
                            <span className="text-xs text-muted-foreground">Created</span>
                            <span className="text-sm font-medium">
                              {format(new Date(currentMessage.created_at), 'PPp')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Technical IDs - Advanced Details */}
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="advanced">
                        <AccordionTrigger className="text-xs py-2">Advanced Details</AccordionTrigger>
                        <AccordionContent className="space-y-1 text-xs">
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">ID</span>
                            <span className="font-mono bg-muted/50 px-1 rounded">{currentMessage.id}</span>
                          </div>
                          
                          {currentMessage.telegram_message_id && (
                            <div className="flex justify-between py-1">
                              <span className="text-muted-foreground">Telegram ID</span>
                              <span className="font-mono bg-muted/50 px-1 rounded truncate max-w-[180px]">
                                {currentMessage.telegram_message_id}
                              </span>
                            </div>
                          )}
                          
                          {currentMessage.media_group_id && (
                            <div className="flex justify-between py-1">
                              <span className="text-muted-foreground">Group ID</span>
                              <span className="font-mono bg-muted/50 px-1 rounded truncate max-w-[180px]">
                                {currentMessage.media_group_id}
                              </span>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this media?</AlertDialogTitle>
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
