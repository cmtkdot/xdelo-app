
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { getProcessingStateColor } from '@/utils/mediaUtils';

interface MessageContentProps {
  message: Message;
}

export const MessageContent: React.FC<MessageContentProps> = ({ message }) => {
  const productName = message.analyzed_content?.product_name;
  const vendorUid = message.analyzed_content?.vendor_uid;
  const productCode = message.analyzed_content?.product_code;
  
  return (
    <div className="flex-grow min-w-0">
      <div className="line-clamp-2 text-sm">
        {productName ? (
          <span className="font-medium">{productName}</span>
        ) : (
          <span>{message.caption || "No caption"}</span>
        )}
      </div>
      
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
        <span className="truncate">
          {new Date(message.created_at || Date.now()).toLocaleDateString()}
        </span>
        
        {message.processing_state && (
          <Badge 
            className={cn(
              "text-[10px] px-1 py-0 h-4",
              getProcessingStateColor(message.processing_state)
            )}
          >
            {message.processing_state}
          </Badge>
        )}
        
        {vendorUid && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            {vendorUid}
          </Badge>
        )}
        
        {productCode && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-muted/30">
            {productCode}
          </Badge>
        )}
      </div>
    </div>
  );
};
