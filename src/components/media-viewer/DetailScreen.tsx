
import React, { useState } from 'react'
import { Message } from '@/types/entities/Message'
import { AnalyzedContent } from '@/types/utils/AnalyzedContent'
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

interface MediaViewerDetailProps {
  isOpen: boolean
  onClose: () => void
  currentGroup: Message[]
  initialIndex?: number
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
}

export function MediaViewerDetail({
  isOpen,
  onClose,
  currentGroup,
  initialIndex = 0,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: MediaViewerDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [captionValue, setCaptionValue] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { handleDelete, isProcessing } = useTelegramOperations()
  
  const currentMedia = currentGroup[currentIndex]
  
  // Reset current index when group changes
  React.useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [currentGroup, initialIndex])
  
  // Initialize caption value when media changes
  React.useEffect(() => {
    if (currentMedia) {
      setCaptionValue(currentMedia.caption || '')
    }
  }, [currentMedia])
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    } else if (onPrevious) {
      onPrevious()
    }
  }
  
  const handleNext = () => {
    if (currentIndex < currentGroup.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else if (onNext) {
      onNext()
    }
  }
  
  const handleEditCaptionClick = () => {
    setIsEditingCaption(true)
  }
  
  const handleSaveCaption = async () => {
    // Implementation for saving caption would go here
    // For now, just close the editing mode
    setIsEditingCaption(false)
  }
  
  const handleCancelEdit = () => {
    setCaptionValue(currentMedia.caption || '')
    setIsEditingCaption(false)
  }
  
  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true)
  }
  
  const handleDeleteConfirm = async (deleteFrom: 'database' | 'telegram' | 'both') => {
    if (!currentMedia) return
    
    try {
      if (deleteFrom === 'database') {
        await handleDelete(currentMedia, false)
      } else if (deleteFrom === 'telegram') {
        await handleDelete(currentMedia, true)
      } else if (deleteFrom === 'both') {
        await handleDelete(currentMedia, true)
      }
      
      setIsDeleteDialogOpen(false)
      onClose()
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }
  
  const openTelegramLink = () => {
    // Add safety checks to prevent undefined.replace() error
    if (!currentMedia?.chat_id) return;
    
    const chatIdStr = currentMedia.chat_id.toString();
    const chatId = chatIdStr.startsWith('-100') ? chatIdStr.replace('-100', '') : chatIdStr;
    const messageId = currentMedia?.telegram_message_id;
    
    if (chatId && messageId) {
      window.open(`https://t.me/c/${chatId}/${messageId}`, '_blank');
    }
  }
  
  // Handle keyboard navigation
  React.useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
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
        default:
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleNext, handlePrevious, onClose])
  
  if (!currentMedia) return null
  
  const canNavigatePrev = currentIndex > 0 || !!hasPrevious
  const canNavigateNext = currentIndex < currentGroup.length - 1 || !!hasNext
  const isVideo = currentMedia.mime_type?.startsWith('video/')
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-6xl w-full h-[90vh] p-0 gap-0 overflow-hidden">
          {/* Main content with two columns */}
          <div className="grid grid-cols-1 md:grid-cols-5 h-full overflow-hidden">
            {/* Media container - Left column (3/5 width on desktop) */}
            <div className="col-span-1 md:col-span-3 flex flex-col overflow-hidden bg-black relative">
              {/* Media display */}
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                {isVideo ? (
                  <video 
                    src={currentMedia.public_url} 
                    controls 
                    className="max-h-full max-w-full"
                  />
                ) : (
                  <img
                    src={currentMedia.public_url}
                    alt={currentMedia.caption || "Media"}
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
              
              {/* Navigation arrows */}
              {canNavigatePrev && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              
              {canNavigateNext && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
              
              {/* Media count indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {currentGroup.length}
              </div>
            </div>
            
            {/* Info container - Right column (2/5 width on desktop) */}
            <div className="col-span-1 md:col-span-2 h-full overflow-y-auto bg-background border-l">
              <div className="p-6 flex flex-col space-y-4 h-full">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">
                    Media Details
                  </DialogTitle>
                </DialogHeader>
                
                {/* Action buttons */}
                <div className="flex space-x-2 pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleEditCaptionClick}
                          disabled={isEditingCaption}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Caption
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Edit the caption of this message
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleDeleteClick}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Delete this message
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={openTelegramLink}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Telegram
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Open in Telegram
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* Caption editing area */}
                {isEditingCaption ? (
                  <div className="space-y-2">
                    <Textarea
                      value={captionValue}
                      onChange={(e) => setCaptionValue(e.target.value)}
                      placeholder="Enter caption..."
                      className="min-h-[120px]"
                    />
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleSaveCaption}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-md p-4">
                    <h3 className="text-sm font-medium mb-2">Caption</h3>
                    <p className="text-sm whitespace-pre-line">
                      {currentMedia.caption || <span className="text-muted-foreground italic">No caption</span>}
                    </p>
                  </div>
                )}
                
                {/* Tabs for Content and Technical Info */}
                <Tabs defaultValue="analyzed" className="mt-6 flex-1">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="analyzed">Analyzed Content</TabsTrigger>
                    <TabsTrigger value="technical">Technical Details</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="analyzed" className="p-0 mt-4">
                    {currentMedia.analyzed_content ? (
                      <div className="space-y-4">
                        {currentMedia.analyzed_content.product_name && (
                          <div className="bg-muted/30 rounded-md p-4">
                            <h3 className="font-medium mb-2">Product</h3>
                            <p>{currentMedia.analyzed_content.product_name}</p>
                          </div>
                        )}
                        
                        {currentMedia.analyzed_content.quantity && (
                          <div className="bg-muted/30 rounded-md p-4">
                            <h3 className="font-medium mb-2">Quantity</h3>
                            <p>{currentMedia.analyzed_content.quantity}</p>
                          </div>
                        )}
                        
                        {currentMedia.analyzed_content.notes && (
                          <div className="bg-muted/30 rounded-md p-4">
                            <h3 className="font-medium mb-2">Notes</h3>
                            <p>{currentMedia.analyzed_content.notes}</p>
                          </div>
                        )}
                        
                        {/* Previous analysis data if available */}
                        {currentMedia.old_analyzed_content && currentMedia.old_analyzed_content.length > 0 && (
                          <Accordion type="single" collapsible className="mt-6">
                            <AccordionItem value="old-analysis">
                              <AccordionTrigger className="text-sm">
                                <Info className="h-4 w-4 mr-2" />
                                Previous Analysis History
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3 pt-2">
                                  {currentMedia.old_analyzed_content.map((analysis, index) => {
                                    // Type guard for analysis
                                    const typedAnalysis = analysis as Partial<AnalyzedContent & { 
                                      parsing_metadata?: { timestamp?: string } 
                                    }>;
                                    
                                    return (
                                      <div key={index} className="bg-muted/20 p-3 rounded-md">
                                        <div className="text-xs text-muted-foreground mb-1">
                                          {typedAnalysis.parsing_metadata?.timestamp && 
                                            format(new Date(typedAnalysis.parsing_metadata.timestamp), 'PPP p')}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                          {typedAnalysis.product_name && (
                                            <div>Product: <span className="font-medium">{typedAnalysis.product_name}</span></div>
                                          )}
                                          {typedAnalysis.quantity && (
                                            <div>Quantity: <span className="font-medium">{String(typedAnalysis.quantity)}</span></div>
                                          )}
                                          {typedAnalysis.notes && (
                                            <div className="col-span-1 md:col-span-2">
                                              Notes: <span className="font-medium">{String(typedAnalysis.notes)}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        No analyzed content available
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="technical" className="p-0 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {currentMedia.mime_type && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Type</h3>
                          <p className="text-sm">{currentMedia.mime_type}</p>
                        </div>
                      )}
                      
                      {currentMedia.file_size && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Size</h3>
                          <p className="text-sm">{(currentMedia.file_size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      )}
                      
                      {currentMedia.width && currentMedia.height && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Dimensions</h3>
                          <p className="text-sm">{currentMedia.width} × {currentMedia.height}</p>
                        </div>
                      )}
                      
                      {currentMedia.duration && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Duration</h3>
                          <p className="text-sm">{currentMedia.duration}s</p>
                        </div>
                      )}
                      
                      {currentMedia.created_at && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
                          <p className="text-sm">{format(new Date(currentMedia.created_at), 'PPP')}</p>
                        </div>
                      )}
                      
                      {currentMedia.media_group_id && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Group ID</h3>
                          <p className="text-sm">{currentMedia.media_group_id}</p>
                        </div>
                      )}
                      
                      {currentMedia.telegram_message_id && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Message ID</h3>
                          <p className="text-sm">{currentMedia.telegram_message_id}</p>
                        </div>
                      )}
                      
                      {currentMedia.chat_id && (
                        <div className="col-span-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Chat ID</h3>
                          <p className="text-sm">{currentMedia.chat_id}</p>
                        </div>
                      )}
                    </div>
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
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              How would you like to delete this message?
              {currentMedia?.media_group_id && (
                <p className="mt-2 text-sm text-destructive font-medium">
                  Note: This will delete all related media in the group.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0 sm:mt-0">Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => handleDeleteConfirm('database')}
              disabled={isProcessing}
            >
              <Database className="h-4 w-4 mr-2" />
              Database Only
            </Button>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => handleDeleteConfirm('telegram')}
              disabled={isProcessing}
            >
              <Send className="h-4 w-4 mr-2" />
              Telegram Only
            </Button>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleDeleteConfirm('both')}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete From Both
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
