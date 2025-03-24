
import React, { useState } from 'react';
import { Message } from '@/types/entities/Message';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Info, 
  Database, 
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTelegramOperations } from '@/hooks/useTelegramOperations';

interface PublicMediaDetailProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  initialIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onEdit?: (message: Message, newCaption: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
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
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [deleteOption, setDeleteOption] = useState<'database' | 'telegram'>('database');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const { handleDelete, isProcessing } = useTelegramOperations();
  
  const currentMedia = currentGroup[currentIndex];
  
  // Reset current index when group changes
  React.useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, currentGroup]);
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (onPrevious) {
      onPrevious();
    }
  };
  
  const handleNext = () => {
    if (currentIndex < currentGroup.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (onNext) {
      onNext();
    }
  };
  
  const getMediaType = (mimeType?: string) => {
    if (!mimeType) return 'unknown';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  };
  
  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
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
  }, [currentIndex, currentGroup.length]);
  
  const startEdit = () => {
    setEditedCaption(currentMedia.caption || '');
    setIsEditing(true);
  };
  
  const cancelEdit = () => {
    setIsEditing(false);
  };
  
  const saveEdit = async () => {
    if (onEdit) {
      await onEdit(currentMedia, editedCaption);
    }
    setIsEditing(false);
  };

  const confirmDelete = async () => {
    try {
      const deleteTelegram = deleteOption === 'telegram';
      await handleDelete(currentMedia, deleteTelegram);
      if (onDelete) {
        await onDelete(currentMedia.id);
      }
      setIsDeleteDialogOpen(false);
      // Close the media viewer after successful deletion
      onClose();
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };
  
  const mediaType = getMediaType(currentMedia?.mime_type);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full p-0 gap-0">
        {/* Navigation controls */}
        <div className="relative">
          {hasPrevious && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 rounded-full bg-black/20 hover:bg-black/40"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </Button>
          )}
          
          {hasNext && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 rounded-full bg-black/20 hover:bg-black/40"
              onClick={onNext}
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </Button>
          )}
          
          {/* Media display */}
          <div className="flex justify-center bg-black/5 dark:bg-black/40 h-[50vh] md:h-[70vh] items-center p-4">
            {mediaType === 'image' && (
              <img 
                src={currentMedia.public_url} 
                alt={currentMedia.caption || 'Image'} 
                className="h-full max-h-full max-w-full object-contain"
              />
            )}
            {mediaType === 'video' && (
              <video 
                src={currentMedia.public_url} 
                controls 
                className="h-full max-h-full max-w-full"
              />
            )}
            {mediaType === 'document' && (
              <div className="text-center">
                <p className="mb-4">Document: {currentMedia.mime_type}</p>
                <Button asChild>
                  <a href={currentMedia.public_url} target="_blank" rel="noopener noreferrer">
                    Download File
                  </a>
                </Button>
              </div>
            )}
          </div>
          
          {/* Group navigation controls (if multiple items in the group) */}
          {currentGroup.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
              {currentGroup.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentIndex 
                      ? "bg-primary w-4" 
                      : "bg-gray-400/50 hover:bg-gray-400/80"
                  )}
                  aria-label={`Go to item ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Caption and details section */}
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              {!isEditing ? (
                <p className="text-sm mb-1">
                  {currentMedia.caption || 'No caption'}
                </p>
              ) : (
                <div className="space-y-2">
                  <Textarea 
                    value={editedCaption} 
                    onChange={(e) => setEditedCaption(e.target.value)} 
                    rows={3}
                    className="w-full"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {currentMedia.created_at && (
                  <span>
                    {format(new Date(currentMedia.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
                {currentMedia.mime_type && (
                  <span>{currentMedia.mime_type}</span>
                )}
                {currentMedia.file_size && (
                  <span>{Math.round(currentMedia.file_size / 1024)} KB</span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 ml-4">
              {/* Edit button (if onEdit is provided) */}
              {onEdit && !isEditing && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={startEdit}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit caption</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {/* Delete button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete media</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Open in new tab button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      asChild
                    >
                      <a 
                        href={currentMedia.public_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in new tab</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          {/* Additional details in accordion */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details">
              <AccordionTrigger className="text-xs text-muted-foreground py-2">
                <div className="flex items-center">
                  <Info className="h-3 w-3 mr-1" />
                  <span>Details</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <p className="font-medium">File ID</p>
                    <p className="truncate">{currentMedia.file_unique_id}</p>
                  </div>
                  <div>
                    <p className="font-medium">Message ID</p>
                    <p>{currentMedia.telegram_message_id}</p>
                  </div>
                  {currentMedia.media_group_id && (
                    <div>
                      <p className="font-medium">Group ID</p>
                      <p className="truncate">{currentMedia.media_group_id}</p>
                    </div>
                  )}
                  {currentMedia.width && currentMedia.height && (
                    <div>
                      <p className="font-medium">Dimensions</p>
                      <p>{currentMedia.width} × {currentMedia.height}</p>
                    </div>
                  )}
                  {currentMedia.duration && (
                    <div>
                      <p className="font-medium">Duration</p>
                      <p>{currentMedia.duration}s</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              How would you like to delete this media?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex flex-col gap-2 my-4">
            <div 
              className={cn(
                "border p-3 rounded-md cursor-pointer",
                deleteOption === 'database' ? "border-primary bg-primary/5" : "border-muted"
              )}
              onClick={() => setDeleteOption('database')}
            >
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="font-medium">Database only</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Mark as deleted in the database but keep in Telegram
              </p>
            </div>
            
            <div 
              className={cn(
                "border p-3 rounded-md cursor-pointer",
                deleteOption === 'telegram' ? "border-primary bg-primary/5" : "border-muted"
              )}
              onClick={() => setDeleteOption('telegram')}
            >
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="font-medium">Delete everywhere</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Delete from both the database and Telegram
              </p>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
