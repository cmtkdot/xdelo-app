import React, { useState, useEffect, useRef } from 'react'
import { Message } from '@/types/entities/Message'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Image as ImageIcon,
  Copy,
  Pencil,
  Trash2,
  MessageSquare 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useToast } from '@/hooks/useToast'

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
  const { toast } = useToast()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editedCaption, setEditedCaption] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const currentMedia = currentGroup[currentIndex]
  
  // Debug when component receives props
  useEffect(() => {
    console.log('PublicMediaDetail: Received props', { 
      isOpen, 
      groupSize: currentGroup?.length || 0,
      initialIndex,
      hasPrevious,
      hasNext
    })
  }, [isOpen, currentGroup, initialIndex, hasPrevious, hasNext])
  
  // Reset current index when group changes
  useEffect(() => {
    console.log('PublicMediaDetail: Group changed, resetting index to', initialIndex)
    setCurrentIndex(initialIndex)
  }, [currentGroup, initialIndex])
  
  // Initialize edited caption when opening edit dialog
  useEffect(() => {
    if (isEditDialogOpen && currentMedia) {
      setEditedCaption(currentMedia.caption || '')
    }
  }, [isEditDialogOpen, currentMedia])
  
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
  
  const openTelegramLink = () => {
    const chatId = currentMedia.chat_id?.toString().replace('-100', '')
    const messageId = currentMedia.telegram_message_id
    
    if (chatId && messageId) {
      window.open(`https://t.me/c/${chatId}/${messageId}`, '_blank')
    }
  }
  
  const openDirectImageLink = () => {
    if (currentMedia.public_url) {
      window.open(currentMedia.public_url, '_blank')
    }
  }
  
  const copyLinkToClipboard = (type: 'telegram' | 'image') => {
    let link = ''
    
    if (type === 'telegram') {
      const chatId = currentMedia.chat_id?.toString().replace('-100', '')
      const messageId = currentMedia.telegram_message_id
      
      if (chatId && messageId) {
        link = `https://t.me/c/${chatId}/${messageId}`
      }
    } else if (type === 'image' && currentMedia.public_url) {
      link = currentMedia.public_url
    }
    
    if (link) {
      navigator.clipboard.writeText(link)
        .then(() => {
          toast({
            title: 'Link copied',
            description: 'Link has been copied to clipboard',
          })
        })
        .catch(() => {
          toast({
            title: 'Failed to copy',
            description: 'Could not copy link to clipboard',
            variant: 'destructive',
          })
        })
    }
  }

  const handleEditSubmit = async () => {
    if (!onEdit || !currentMedia) return
    
    try {
      setIsSubmitting(true)
      await onEdit(currentMedia, editedCaption)
      toast({
        title: 'Caption updated',
        description: 'Media caption has been successfully updated',
      })
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating caption:', error)
      toast({
        title: 'Update failed',
        description: 'Could not update the caption. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!onDelete || !currentMedia) return
    
    try {
      setIsSubmitting(true)
      await onDelete(currentMedia.id)
      toast({
        title: 'Media deleted',
        description: 'Media has been successfully deleted',
      })
      setIsDeleteDialogOpen(false)
      
      // If there are more items in the group, show the next one
      // Otherwise close the viewer
      if (currentGroup.length > 1) {
        if (currentIndex === currentGroup.length - 1) {
          setCurrentIndex(currentIndex - 1)
        }
        // If it was the only item, close the viewer
      } else {
        onClose()
      }
    } catch (error) {
      console.error('Error deleting media:', error)
      toast({
        title: 'Delete failed',
        description: 'Could not delete the media. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || isEditDialogOpen || isDeleteDialogOpen) return
    
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
  }, [isOpen, handleNext, handlePrevious, onClose, isEditDialogOpen, isDeleteDialogOpen])
  
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
                <div className="flex flex-wrap gap-2 pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={openTelegramLink}
                          className="bg-[#229ED9] text-white hover:bg-[#229ED9]/80 border-0"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          View in Telegram
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Open original message in Telegram
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={openDirectImageLink}
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Open Media
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        View media in new tab
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => copyLinkToClipboard('image')}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Copy direct link to media
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Edit button */}
                  {onEdit && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setIsEditDialogOpen(true)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Caption
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Edit the caption of this media
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Delete button */}
                  {onDelete && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => setIsDeleteDialogOpen(true)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Delete this media
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Tabs for caption and info */}
                <Tabs defaultValue="caption" className="flex-1 flex flex-col">
                  <TabsList>
                    <TabsTrigger value="caption">Caption</TabsTrigger>
                    <TabsTrigger value="product">Product Info</TabsTrigger>
                    <TabsTrigger value="info">Media Info</TabsTrigger>
                    {currentMedia.old_analyzed_content && 
                      currentMedia.old_analyzed_content.length > 0 && 
                      <TabsTrigger value="history">History</TabsTrigger>
                    }
                  </TabsList>
                  
                  <TabsContent value="caption" className="flex-1 overflow-y-auto">
                    <div className="p-4 border rounded-md h-full overflow-y-auto">
                      {currentMedia.caption ? (
                        <p className="whitespace-pre-wrap">{currentMedia.caption}</p>
                      ) : (
                        <p className="text-muted-foreground italic">No caption</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="product" className="flex-1 overflow-y-auto">
                    <div className="space-y-4 p-4 border rounded-md">
                      {(currentMedia.product_name || 
                        currentMedia.product_code || 
                        currentMedia.vendor_uid || 
                        currentMedia.product_quantity || 
                        currentMedia.purchase_date || 
                        currentMedia.notes) ? (
                        <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-sm">
                          {currentMedia.product_name && (
                            <>
                              <div className="font-medium">Product Name</div>
                              <div className="col-span-2">{currentMedia.product_name}</div>
                            </>
                          )}
                          
                          {currentMedia.product_code && (
                            <>
                              <div className="font-medium">Product Code</div>
                              <div className="col-span-2">{currentMedia.product_code}</div>
                            </>
                          )}
                          
                          {currentMedia.product_sku && (
                            <>
                              <div className="font-medium">SKU</div>
                              <div className="col-span-2">{currentMedia.product_sku}</div>
                            </>
                          )}
                          
                          {currentMedia.vendor_uid && (
                            <>
                              <div className="font-medium">Vendor</div>
                              <div className="col-span-2">{currentMedia.vendor_uid}</div>
                            </>
                          )}
                          
                          {currentMedia.product_quantity && (
                            <>
                              <div className="font-medium">Quantity</div>
                              <div className="col-span-2">{currentMedia.product_quantity}</div>
                            </>
                          )}
                          
                          {currentMedia.purchase_date && (
                            <>
                              <div className="font-medium">Purchase Date</div>
                              <div className="col-span-2">
                                {new Date(currentMedia.purchase_date).toLocaleDateString()}
                              </div>
                            </>
                          )}
                          
                          {currentMedia.glide_row_id && (
                            <>
                              <div className="font-medium">Glide ID</div>
                              <div className="col-span-2">{currentMedia.glide_row_id}</div>
                            </>
                          )}
                          
                          {currentMedia.notes && (
                            <>
                              <div className="font-medium">Notes</div>
                              <div className="col-span-2 whitespace-pre-wrap">{currentMedia.notes}</div>
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No product information available</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="info" className="flex-1 overflow-y-auto">
                    <div className="space-y-4 p-4 border rounded-md">
                      <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-sm">
                        <div className="font-medium">Type</div>
                        <div className="col-span-2">{currentMedia.mime_type || 'Unknown'}</div>
                        
                        <div className="font-medium">Size</div>
                        <div className="col-span-2">
                          {currentMedia.file_size 
                            ? `${(currentMedia.file_size / (1024 * 1024)).toFixed(2)} MB`
                            : 'Unknown'}
                        </div>
                        
                        <div className="font-medium">Created</div>
                        <div className="col-span-2">
                          {currentMedia.created_at 
                            ? format(new Date(currentMedia.created_at), 'PPP p')
                            : 'Unknown'}
                        </div>
                        
                        <div className="font-medium">Message ID</div>
                        <div className="col-span-2 truncate">{currentMedia.telegram_message_id || 'Unknown'}</div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {currentMedia.old_analyzed_content && currentMedia.old_analyzed_content.length > 0 && (
                    <TabsContent value="history" className="flex-1 overflow-y-auto">
                      <div className="space-y-6 p-4 border rounded-md">
                        {currentMedia.old_analyzed_content.map((item, index) => (
                          <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                            <h4 className="font-medium text-sm mb-2">Previous Record {index + 1}</h4>
                            <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-sm">
                              {item.product_name && (
                                <>
                                  <div className="font-medium">Product Name</div>
                                  <div className="col-span-2">{item.product_name as string}</div>
                                </>
                              )}
                              
                              {item.product_code && (
                                <>
                                  <div className="font-medium">Product Code</div>
                                  <div className="col-span-2">{item.product_code as string}</div>
                                </>
                              )}
                              
                              {item.vendor_uid && (
                                <>
                                  <div className="font-medium">Vendor</div>
                                  <div className="col-span-2">{item.vendor_uid as string}</div>
                                </>
                              )}
                              
                              {item.quantity && (
                                <>
                                  <div className="font-medium">Quantity</div>
                                  <div className="col-span-2">{item.quantity as string}</div>
                                </>
                              )}
                              
                              {item.purchase_date && (
                                <>
                                  <div className="font-medium">Purchase Date</div>
                                  <div className="col-span-2">
                                    {new Date(item.purchase_date as string).toLocaleDateString()}
                                  </div>
                                </>
                              )}
                              
                              {item.notes && (
                                <>
                                  <div className="font-medium">Notes</div>
                                  <div className="col-span-2 whitespace-pre-wrap">{item.notes as string}</div>
                                </>
                              )}
                              
                              {item.timestamp && (
                                <>
                                  <div className="font-medium">Timestamp</div>
                                  <div className="col-span-2">
                                    {new Date(item.timestamp as string).toLocaleString()}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Caption Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Caption</DialogTitle>
            <DialogDescription>
              Update the caption for this media. The changes will be reflected in Telegram as well.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            value={editedCaption}
            onChange={(e) => setEditedCaption(e.target.value)}
            placeholder="Enter caption..."
            className="h-40 resize-none"
          />
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this media? This action will mark it as deleted in the database and can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 