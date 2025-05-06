import { MediaPlayer } from '@/components/common/MediaPlayer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { useClipboard } from '@/hooks/useClipboard';
import { useSharingOptions } from '@/hooks/useSharingOptions';
import { cn } from '@/lib/utils';
import { isVideoMessage } from '@/lib/videoUtils';
import { Message } from '@/types/message';
import { formatDistanceToNow } from 'date-fns';
import {
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Info,
  Package,
  RotateCcw,
  Share,
  Tag,
  User,
} from 'lucide-react';
import React, { useState } from 'react';

interface PublicEnhancedMediaDetailProps {
  message: Message;
  onBack?: () => void;
  onShare?: () => void;
  onShowOriginal?: () => void;
}

export function PublicEnhancedMediaDetail({
  message,
  onBack: _onBack, // Prefix with underscore to indicate intentionally unused parameter
  onShare,
  onShowOriginal,
}: PublicEnhancedMediaDetailProps) {
  const [activeTab, setActiveTab] = useState('info');
  const { copyToClipboard } = useClipboard();
  const { showSharingDialog } = useSharingOptions();
  const isVideo = isVideoMessage(message);

  // Function to copy text to clipboard with toast notification
  const handleCopy = (text: string, label: string) => {
    if (!text) return;

    copyToClipboard(text);
    toast({
      title: `${label} copied`,
      description: 'Copied to clipboard successfully',
    });
  };

  // Compute extension from mime type
  const getExtension = (mimeType?: string): string => {
    if (!mimeType) return '';
    const parts = mimeType.split('/');
    return parts.length > 1 ? parts[1] : '';
  };

  const handleSharingOptions = () => {
    if (onShare) {
      onShare();
    } else {
      showSharingDialog({
        title: message.analyzed_content?.product_name || 'Media',
        text: message.caption || '',
        url: message.public_url,
      });
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 py-2 animate-in fade-in duration-300">
      {/* Media Display Area */}
      <div className="relative w-full rounded-lg overflow-hidden bg-black/5 border">
        <MediaPlayer
          message={message}
          thumbnailMode={true}
          autoPlay={false}
          loop={true}
          muted={true}
          showLoadingIndicator={true}
          className="w-full max-h-[70vh]"
        />

        {/* Media metadata overlay */}
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          <Badge variant="secondary" className="opacity-80 backdrop-blur-sm">
            {isVideo ? 'Video' : 'Image'}
          </Badge>
          <Badge variant="secondary" className="opacity-80 backdrop-blur-sm">
            {getExtension(message.mime_type)}
          </Badge>
          {message.telegram_data?.width && message.telegram_data?.height && (
            <Badge variant="secondary" className="opacity-80 backdrop-blur-sm">
              {message.telegram_data.width}×{message.telegram_data.height}
            </Badge>
          )}
        </div>
      </div>

      {/* Product info card - Always visible */}
      {message.analyzed_content && (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border">
          <h2 className="text-xl font-semibold">
            {message.analyzed_content.product_name || "Product"}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
            {message.analyzed_content.product_code && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium truncate">{message.analyzed_content.product_code}</span>
              </div>
            )}

            {message.analyzed_content.vendor_uid && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium truncate">{message.analyzed_content.vendor_uid}</span>
              </div>
            )}

            {message.analyzed_content.quantity && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">Qty: {message.analyzed_content.quantity}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4 pt-4">
          {/* Caption as subtitle if different from product name */}
          {message.caption && (!message.analyzed_content?.product_name ||
            message.analyzed_content.product_name !== message.caption) && (
              <div className="bg-muted/40 p-3 rounded-md">
                <h3 className="text-sm font-medium mb-1">Caption</h3>
                <p className="text-sm">{message.caption}</p>
              </div>
            )}

          {/* Details List */}
          <div className="space-y-2">
            {/* Vendor Info */}
            {message.analyzed_content?.vendor_uid && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Vendor</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{message.analyzed_content.vendor_uid}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() =>
                        handleCopy(message.analyzed_content?.vendor_uid || '', 'Vendor ID')
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity Info */}
            {message.analyzed_content?.quantity && (
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Quantity</p>
                  <p className="text-sm">{message.analyzed_content.quantity}</p>
                </div>
              </div>
            )}

            {/* Product Code */}
            {message.analyzed_content?.product_code && (
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Product Code</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{message.analyzed_content.product_code}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() =>
                        handleCopy(message.analyzed_content?.product_code || '', 'Product Code')
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Display any additional analyzed content fields */}
            {message.analyzed_content && Object.entries(message.analyzed_content)
              .filter(([key]) => !['product_name', 'product_code', 'vendor_uid', 'quantity'].includes(key))
              .map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;

                return (
                  <div key={key} className="flex items-start gap-3">
                    <Info className="w-5 h-5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="text-sm">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </p>
                    </div>
                  </div>
                );
              })}

            {/* Timestamp */}
            {message.created_at && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Added</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="pt-4">
          <div className="space-y-3">
            {/* File Info */}
            <div>
              <h3 className="text-sm font-medium mb-2">File Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">File Type</div>
                <div>{message.mime_type || 'Unknown'}</div>

                <div className="text-muted-foreground">Extension</div>
                <div>{getExtension(message.mime_type)}</div>

                {message.telegram_data?.file_size && (
                  <>
                    <div className="text-muted-foreground">File Size</div>
                    <div>{(message.telegram_data.file_size / 1024 / 1024).toFixed(2)} MB</div>
                  </>
                )}

                {message.telegram_data?.width && message.telegram_data?.height && (
                  <>
                    <div className="text-muted-foreground">Dimensions</div>
                    <div>{message.telegram_data.width} × {message.telegram_data.height}</div>
                  </>
                )}

                {message.public_url && (
                  <>
                    <div className="text-muted-foreground">URL</div>
                    <div className="truncate">
                      <a
                        href={message.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate inline-flex items-center gap-1"
                      >
                        {message.public_url.substring(0, 30)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button
              onClick={() => handleCopy(message.public_url || '', 'Media URL')}
              className="flex flex-col items-center justify-center h-auto py-3"
              variant="outline"
            >
              <Copy className="h-6 w-6 mb-1" />
              <span className="text-xs">Copy URL</span>
            </Button>

            <Button
              onClick={handleSharingOptions}
              className="flex flex-col items-center justify-center h-auto py-3"
              variant="outline"
            >
              <Share className="h-6 w-6 mb-1" />
              <span className="text-xs">Share</span>
            </Button>

            <a
              href={message.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex flex-col items-center justify-center h-auto py-3',
                'bg-background hover:bg-accent hover:text-accent-foreground',
                'rounded-md border border-input text-center font-medium'
              )}
              download
            >
              <ExternalLink className="h-6 w-6 mb-1" />
              <span className="text-xs">Open in New Tab</span>
            </a>

            {onShowOriginal && (
              <Button
                onClick={onShowOriginal}
                className="flex flex-col items-center justify-center h-auto py-3"
                variant="outline"
              >
                <RotateCcw className="h-6 w-6 mb-1" />
                <span className="text-xs">View Original</span>
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Dialog wrapper version of the media detail component
 */
export function PublicMediaDetailDialog({
  message,
  open,
  onOpenChange,
  children,
  onShowOriginal,
}: {
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  onShowOriginal?: () => void;
}) {
  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] p-4 sm:p-6">
        <PublicEnhancedMediaDetail message={message} onShowOriginal={onShowOriginal} />
      </DialogContent>
    </Dialog>
  );
}
