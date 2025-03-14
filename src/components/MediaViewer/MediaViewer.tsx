
import React, { useState } from 'react';
import { Message } from '@/types/MessagesTypes';
import { MediaItem } from '@/types';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { ChevronLeft, ChevronRight, Tag, Package, Calendar, Settings, ExternalLink, FileText, X } from "lucide-react";
import { format } from 'date-fns';
import { cn } from '@/lib/generalUtils';
import { messageToMediaItem } from './types';
import { MediaFixButton } from './MediaFixButton';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ResponsiveContainer } from "@/components/ui/responsive-container";

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  editMode?: boolean;
}

export const MediaViewer = ({
  isOpen,
  onClose,
  currentGroup = [], // Provide default empty array
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  editMode = false
}: MediaViewerProps) => {
  const [showTools, setShowTools] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const { isMobile } = useBreakpoint();

  // Guard against null or undefined currentGroup
  if (!currentGroup || !Array.isArray(currentGroup) || currentGroup.length === 0) {
    return null;
  }

  const mainMedia = currentGroup?.find(media => media?.is_original_caption) || currentGroup?.[0];
  const analyzedContent = mainMedia?.analyzed_content || {};
  const currentMedia = currentGroup?.[activeMediaIndex] || mainMedia;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      return '';
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPrevious && hasPrevious) onPrevious();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onNext && hasNext) onNext();
  };

  const handleToolsComplete = () => {
    setShowTools(false);
  };

  const handleMediaChange = (index: number) => {
    setActiveMediaIndex(index);
  };

  const getTelegramMessageUrl = (message: Message) => {
    if (!message || !message.chat_id || !message.telegram_message_id) return null;
    
    return `https://t.me/c/${message.chat_id.toString().replace("-100", "")}/${message.telegram_message_id}`;
  };

  const mediaItems: MediaItem[] = Array.isArray(currentGroup) 
    ? currentGroup.map(message => message ? messageToMediaItem(message) : null).filter(Boolean) as MediaItem[]
    : [];
  const messageIds = Array.isArray(currentGroup) ? currentGroup.map(message => message?.id).filter(Boolean) : [];
  const telegramUrl = getTelegramMessageUrl(currentMedia);
  const publicUrl = currentMedia?.public_url || null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 md:max-h-[90vh] h-[100vh] md:h-auto overflow-hidden">
        <div className="relative flex flex-col bg-background dark:bg-background h-full overflow-hidden">
          {/* Top navigation bar with product navigation */}
          <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/10">
            <div className="flex items-center">
              {hasPrevious && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handlePrevious} 
                  className="mr-1"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Previous Product</span>
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setShowTools(!showTools)}>
                <Settings className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Tools</span>
              </Button>
              
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Close</span>
              </Button>
            </div>
            
            <div className="flex items-center">
              {hasNext && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleNext}
                  className="ml-1"
                >
                  <span className="hidden sm:inline">Next Product</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Media viewer area */}
          <div className="relative flex-1 min-h-0 bg-black/90 overflow-hidden">
            {mediaItems.length > 1 ? (
              <Carousel 
                className="w-full h-full"
                onSelect={(index) => setActiveMediaIndex(index)}
              >
                <CarouselContent className="h-full">
                  {mediaItems.map((item, index) => (
                    <CarouselItem key={item.id} className="h-full">
                      <div className="aspect-video w-full h-full flex items-center justify-center relative overflow-hidden">
                        {item.mime_type?.startsWith('video/') ? (
                          <video 
                            src={item.public_url} 
                            className="w-full h-full object-contain"
                            controls
                          />
                        ) : (
                          <img 
                            src={item.public_url} 
                            alt={item.caption || 'Media item'} 
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                
                <div className="absolute inset-0 flex justify-between items-center pointer-events-none">
                  <CarouselPrevious className="relative h-8 w-8 ml-2 pointer-events-auto" />
                  <CarouselNext className="relative h-8 w-8 mr-2 pointer-events-auto" />
                </div>
                
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
                  {activeMediaIndex + 1} / {mediaItems.length}
                </div>
              </Carousel>
            ) : (
              <div className="aspect-video w-full h-full flex items-center justify-center">
                {mediaItems[0]?.mime_type?.startsWith('video/') ? (
                  <video 
                    src={mediaItems[0]?.public_url} 
                    className="w-full h-full object-contain"
                    controls
                  />
                ) : (
                  <img 
                    src={mediaItems[0]?.public_url} 
                    alt={mediaItems[0]?.caption || 'Media item'} 
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}
          </div>
          
          {/* Tools area */}
          {showTools && (
            <div className="p-2 border-t bg-muted/10 flex justify-center">
              <MediaFixButton messageIds={messageIds} onComplete={handleToolsComplete} />
            </div>
          )}
          
          {/* External links */}
          <div className="py-2 px-3 bg-muted/10 border-t flex flex-wrap justify-center gap-2">
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="flex gap-1 items-center">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">View Original File</span>
                  <span className="sm:hidden">File</span>
                </Button>
              </a>
            )}
            
            {telegramUrl && (
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="flex gap-1 items-center">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Open in Telegram</span>
                  <span className="sm:hidden">Telegram</span>
                </Button>
              </a>
            )}
          </div>

          {/* Content area - scrollable */}
          <div className="overflow-y-auto flex-grow-0">
            <ResponsiveContainer mobilePadding="sm">
              {/* Caption display */}
              {mainMedia?.caption && (
                <div className="p-3 bg-secondary/5 rounded-lg my-3">
                  <p className="whitespace-pre-wrap text-sm sm:text-base text-center">{mainMedia.caption}</p>
                </div>
              )}

              {/* Product information grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {mainMedia?.purchase_order && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Tag className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Order ID</p>
                      <p className="text-sm font-medium truncate">{mainMedia.purchase_order}</p>
                    </div>
                  </div>
                )}
                
                {analyzedContent?.product_name && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Tag className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Product</p>
                      <p className="text-sm font-medium truncate">{analyzedContent.product_name}</p>
                    </div>
                  </div>
                )}
                
                {analyzedContent?.quantity && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Package className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="text-sm font-medium truncate">{analyzedContent.quantity}</p>
                    </div>
                  </div>
                )}

                {analyzedContent?.vendor_uid && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Tag className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Vendor</p>
                      <p className="text-sm font-medium truncate">{analyzedContent.vendor_uid}</p>
                    </div>
                  </div>
                )}
                
                {analyzedContent?.product_code && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Tag className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Product Code</p>
                      <p className="text-sm font-medium truncate">{analyzedContent.product_code}</p>
                    </div>
                  </div>
                )}

                {analyzedContent?.purchase_date && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Purchase Date</p>
                      <p className="text-sm font-medium truncate">
                        {formatDate(analyzedContent.purchase_date)}
                      </p>
                    </div>
                  </div>
                )}
                
                {analyzedContent?.unit_price && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Tag className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Unit Price</p>
                      <p className="text-sm font-medium truncate">
                        ${analyzedContent.unit_price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
                
                {analyzedContent?.total_price && (
                  <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                    <Tag className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Total Price</p>
                      <p className="text-sm font-medium truncate">
                        ${analyzedContent.total_price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ResponsiveContainer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
