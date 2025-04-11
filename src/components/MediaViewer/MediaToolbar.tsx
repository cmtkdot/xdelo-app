import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Link } from 'lucide-react';
import { Message } from '@/types';
import { getTelegramMessageUrl } from '@/utils/mediaUtils';

interface MediaToolbarProps {
  currentMedia: Message;
  className?: string;
}

export function MediaToolbar({ 
  currentMedia, 
  className
}: MediaToolbarProps) {
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const telegramUrl = currentMedia ? getTelegramMessageUrl(currentMedia) : null;

  // Handle copy telegram URL
  const handleCopyTelegramUrl = async () => {
    if (telegramUrl) {
      try {
        await navigator.clipboard.writeText(telegramUrl);
        setIsUrlCopied(true);
        setTimeout(() => setIsUrlCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  };



  return (
    <div className={`border-t p-2 bg-background ${className || ''}`}>
      <div className="flex items-center gap-2 justify-between">
        {telegramUrl && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-1"
            onClick={handleCopyTelegramUrl}
          >
            {isUrlCopied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Link className="h-4 w-4" />
                <span>Telegram URL</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
