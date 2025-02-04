import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { SyncButton } from './ProductGroup/SyncButton';
import { Tables } from '@/integrations/supabase/types';

interface ProductGroupProps {
  message: Tables<'messages'>;
  onSelect?: () => void;
  selected?: boolean;
  showDetails?: boolean;
}

export const ProductGroup: React.FC<ProductGroupProps> = ({ 
  message,
  onSelect,
  selected = false,
  showDetails = false,
}) => {
  const hasCaption = message.caption && message.caption.trim().length > 0;
  const isProcessed = message.processing_state === 'completed';
  const isProcessing = message.processing_state === 'processing';
  const hasError = message.processing_state === 'error';

  return (
    <div className="relative group">
      <Card 
        className={`
          overflow-hidden transition-all
          ${selected ? 'ring-2 ring-primary' : ''}
          ${onSelect ? 'cursor-pointer' : ''}
          ${hasError ? 'border-red-500' : ''}
        `}
        onClick={onSelect}
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <SyncButton messageId={message.id} />
        </div>

        {message.public_url && (
          <div className="relative aspect-square">
            <img
              src={message.public_url}
              alt={message.caption || 'Product image'}
              className="object-cover w-full h-full"
            />
          </div>
        )}

        <div className="p-4">
          {hasCaption && (
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {message.caption}
            </p>
          )}

          {showDetails && (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2 flex-wrap">
                {message.is_original_caption && (
                  <Badge variant="secondary">Original Caption</Badge>
                )}
                {message.media_group_id && (
                  <Badge variant="outline">Group: {message.media_group_id}</Badge>
                )}
                {isProcessed && (
                  <Badge variant="default">Processed</Badge>
                )}
                {isProcessing && (
                  <Badge variant="secondary">Processing</Badge>
                )}
                {hasError && (
                  <Badge variant="destructive">Error</Badge>
                )}
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>ID: {message.id}</p>
                <p>Created: {formatDate(message.created_at)}</p>
                {message.processing_completed_at && (
                  <p>Processed: {formatDate(message.processing_completed_at)}</p>
                )}
              </div>

              {message.error_message && (
                <div className="text-xs text-red-500 mt-2">
                  Error: {message.error_message}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};