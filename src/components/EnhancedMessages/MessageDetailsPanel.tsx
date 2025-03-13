
import React, { useState } from 'react';
import { Message, ProcessingState } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { 
  RefreshCw, 
  Clock, 
  Calendar, 
  Tag, 
  Hash, 
  Package, 
  Info,
  DollarSign,
  FileText,
  Layers,
  History,
  User,
  MessageSquare,
  Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useUnifiedMediaRepair } from '@/hooks/useUnifiedMediaRepair';
import { useToast } from '@/hooks/useToast';

interface MessageDetailsPanelProps {
  message: Message;
}

export const MessageDetailsPanel: React.FC<MessageDetailsPanelProps> = ({ message }) => {
  const [activeTab, setActiveTab] = useState('product');
  const { repairMedia, isRepairing } = useUnifiedMediaRepair();
  const { toast } = useToast();
  
  // Format dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // Handle repair click
  const handleRepair = async () => {
    try {
      await repairMedia({
        messageIds: [message.id],
        fixContentTypes: true,
        forceRedownload: false
      });
      
      toast({
        title: 'Repair initiated',
        description: 'The message is being repaired.'
      });
    } catch (error) {
      console.error('Repair error:', error);
      toast({
        title: 'Repair failed',
        description: 'An error occurred during repair.',
        variant: 'destructive'
      });
    }
  };
  
  // Determine media type icon and label
  const isVideo = message.mime_type?.startsWith('video/');
  const isImage = message.mime_type?.startsWith('image/');
  const isDocument = message.mime_type?.startsWith('application/');
  
  // Get processing state badge variant
  const getProcessingStateVariant = (state?: ProcessingState) => {
    switch (state) {
      case 'completed': return 'default';
      case 'error': return 'destructive';
      case 'processing': return 'secondary';
      default: return 'outline';
    }
  };
  
  // Get formatted file size
  const getFormattedFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="space-y-4">
      {/* Preview section */}
      <Card>
        <CardContent className="p-0">
          <AspectRatio ratio={1 / 1}>
            {isVideo ? (
              <video 
                src={message.public_url} 
                className="w-full h-full object-cover rounded-t-md" 
                controls
                preload="metadata"
              />
            ) : (
              <img
                src={message.public_url}
                alt={message.caption || 'Message media'}
                className="w-full h-full object-cover rounded-t-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder.svg';
                  target.classList.add('bg-muted');
                }}
              />
            )}
          </AspectRatio>
          
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <Badge variant={getProcessingStateVariant(message.processing_state as ProcessingState)}>
                {message.processing_state}
              </Badge>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-1" 
                onClick={handleRepair}
                disabled={isRepairing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRepairing ? 'animate-spin' : ''}`} />
                Repair
              </Button>
            </div>
            
            {message.caption && (
              <p className="text-sm text-muted-foreground line-clamp-3">{message.caption}</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="product" className="flex-1">Product</TabsTrigger>
          <TabsTrigger value="metadata" className="flex-1">Metadata</TabsTrigger>
          <TabsTrigger value="logs" className="flex-1">History</TabsTrigger>
        </TabsList>
        
        {/* Product Info Tab */}
        <TabsContent value="product" className="space-y-4 mt-4">
          <ScrollArea className="h-[300px] pr-3 -mr-3">
            <div className="space-y-4">
              {message.analyzed_content?.product_name && (
                <div className="flex items-start gap-3">
                  <Tag className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Product Name</p>
                    <p className="font-medium">{message.analyzed_content.product_name}</p>
                  </div>
                </div>
              )}
              
              {message.analyzed_content?.product_code && (
                <div className="flex items-start gap-3">
                  <Hash className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Product Code</p>
                    <p className="font-medium">{message.analyzed_content.product_code}</p>
                  </div>
                </div>
              )}
              
              {message.analyzed_content?.vendor_uid && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Vendor</p>
                    <p className="font-medium">{message.analyzed_content.vendor_uid}</p>
                  </div>
                </div>
              )}
              
              {message.analyzed_content?.quantity !== undefined && (
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="font-medium">{message.analyzed_content.quantity}</p>
                  </div>
                </div>
              )}
              
              {message.analyzed_content?.unit_price !== undefined && (
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Unit Price</p>
                    <p className="font-medium">${message.analyzed_content.unit_price.toFixed(2)}</p>
                  </div>
                </div>
              )}
              
              {message.analyzed_content?.total_price !== undefined && (
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Price</p>
                    <p className="font-medium">${message.analyzed_content.total_price.toFixed(2)}</p>
                  </div>
                </div>
              )}
              
              {message.analyzed_content?.purchase_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">
                      {formatDate(message.analyzed_content.purchase_date)}
                    </p>
                  </div>
                </div>
              )}
              
              {message.analyzed_content?.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="font-medium whitespace-pre-wrap">{message.analyzed_content.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-4 mt-4">
          <ScrollArea className="h-[300px] pr-3 -mr-3">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Message ID</p>
                  <p className="font-mono text-xs">{message.id}</p>
                </div>
              </div>
              
              {message.telegram_message_id && (
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telegram Message ID</p>
                    <p className="font-medium">{message.telegram_message_id}</p>
                  </div>
                </div>
              )}
              
              {message.media_group_id && (
                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Media Group ID</p>
                    <p className="font-medium">{message.media_group_id}</p>
                  </div>
                </div>
              )}
              
              {message.chat_id && (
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Chat</p>
                    <p className="font-medium">
                      {message.chat_title || message.chat_id} 
                      {message.chat_type && ` (${message.chat_type})`}
                    </p>
                  </div>
                </div>
              )}
              
              {message.mime_type && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">File Type</p>
                    <p className="font-medium">{message.mime_type}</p>
                  </div>
                </div>
              )}
              
              {message.file_size !== undefined && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">File Size</p>
                    <p className="font-medium">{getFormattedFileSize(message.file_size)}</p>
                  </div>
                </div>
              )}
              
              {(message.width !== undefined && message.height !== undefined) && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dimensions</p>
                    <p className="font-medium">{message.width} × {message.height}</p>
                  </div>
                </div>
              )}
              
              {message.duration !== undefined && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">{message.duration}s</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(message.created_at)}</p>
                </div>
              </div>
              
              {message.updated_at && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="font-medium">{formatDate(message.updated_at)}</p>
                  </div>
                </div>
              )}
              
              {message.is_forward && (
                <div className="flex items-start gap-3">
                  <Share2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Forward Info</p>
                    <p className="font-medium">
                      Forwarded message
                      {message.forward_count && ` (${message.forward_count} times)`}
                    </p>
                  </div>
                </div>
              )}
              
              {message.storage_path && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Storage Path</p>
                    <p className="font-mono text-xs overflow-auto">{message.storage_path}</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <ScrollArea className="h-[300px] pr-3 -mr-3">
            <div className="space-y-4">
              {message.edit_history && message.edit_history.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Edit History</h4>
                  {message.edit_history.map((edit: any, index: number) => (
                    <div key={index} className="border rounded-md p-3 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline">Edit #{index + 1}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {edit.timestamp ? formatDate(edit.timestamp) : 'Unknown date'}
                        </span>
                      </div>
                      {edit.previous_caption && (
                        <>
                          <p className="text-xs text-muted-foreground mb-1">Previous Caption:</p>
                          <p className="text-xs mb-2">{edit.previous_caption}</p>
                        </>
                      )}
                      {edit.new_caption && (
                        <>
                          <p className="text-xs text-muted-foreground mb-1">New Caption:</p>
                          <p className="text-xs">{edit.new_caption}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No edit history available</p>
                </div>
              )}
              
              {/* Process state history visualization would go here */}
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Processing Details</h4>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="border rounded-md p-2">
                    <p className="text-xs text-muted-foreground">Process State</p>
                    <Badge variant={getProcessingStateVariant(message.processing_state as ProcessingState)}>
                      {message.processing_state}
                    </Badge>
                  </div>
                  
                  <div className="border rounded-md p-2">
                    <p className="text-xs text-muted-foreground">Storage Status</p>
                    <Badge variant={message.storage_exists ? 'default' : 'destructive'}>
                      {message.storage_exists ? 'Exists' : 'Missing'}
                    </Badge>
                  </div>
                  
                  {message.processing_started_at && (
                    <div className="border rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Processing Started</p>
                      <p className="font-medium">{formatDate(message.processing_started_at)}</p>
                    </div>
                  )}
                  
                  {message.processing_completed_at && (
                    <div className="border rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Processing Completed</p>
                      <p className="font-medium">{formatDate(message.processing_completed_at)}</p>
                    </div>
                  )}
                </div>
                
                {message.error_message && (
                  <div className="border border-destructive/30 bg-destructive/10 rounded-md p-3">
                    <p className="text-xs font-medium text-destructive mb-1">Error Message:</p>
                    <p className="text-xs">{message.error_message}</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
