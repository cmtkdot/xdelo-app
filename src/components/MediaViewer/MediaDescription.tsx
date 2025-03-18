
import React from 'react';
import { Message } from '@/types/MessagesTypes';
import { cn } from '@/lib/utils';
import { formatDistance } from 'date-fns';

interface MediaDescriptionProps {
  message: Message;
  className?: string;
}

export function MediaDescription({ message, className }: MediaDescriptionProps) {
  if (!message) return null;
  
  const {
    caption,
    analyzed_content,
    created_at,
    mime_type,
    file_size
  } = message;
  
  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Determine what content to render for product information
  const renderProductInfo = () => {
    if (!analyzed_content) return null;
    
    const {
      product_name,
      product_code,
      vendor_uid,
      quantity,
      purchase_date
    } = analyzed_content;
    
    return (
      <div className="space-y-1">
        {product_name && (
          <div>
            <span className="font-medium">Product:</span> {product_name}
          </div>
        )}
        
        {product_code && (
          <div>
            <span className="font-medium">Code:</span> {product_code}
          </div>
        )}
        
        {vendor_uid && (
          <div>
            <span className="font-medium">Vendor:</span> {vendor_uid}
          </div>
        )}
        
        {quantity && (
          <div>
            <span className="font-medium">Quantity:</span> {quantity}
          </div>
        )}
        
        {purchase_date && (
          <div>
            <span className="font-medium">Purchase Date:</span> {purchase_date}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className={cn("px-4 py-3 space-y-3", className)}>
      {/* Caption */}
      {caption && (
        <div className="font-medium">{caption}</div>
      )}
      
      {/* Product Information */}
      {renderProductInfo()}
      
      {/* Technical Information */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {created_at && (
          <div>
            Uploaded {formatDistance(new Date(created_at), new Date(), { addSuffix: true })}
          </div>
        )}
        
        {mime_type && (
          <div>
            {mime_type.split('/')[1].toUpperCase()}
          </div>
        )}
        
        {file_size && (
          <div>
            {formatFileSize(file_size)}
          </div>
        )}
      </div>
    </div>
  );
}
