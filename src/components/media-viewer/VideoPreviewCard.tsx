
import React, { useState, useEffect } from 'react';
import { Message } from '@/types/entities/Message';
import { Play, ExternalLink } from 'lucide-react';
import { formatDuration } from '@/utils/dateUtils';
import { getVideoDuration } from '@/utils/mediaUtils';
import { 
  InfoCard, 
  InfoCardContent, 
  InfoCardTitle, 
  InfoCardMedia, 
  InfoCardDescription, 
  InfoCardFooter, 
  InfoCardAction
} from '@/components/ui/info-card';
import { Link } from 'react-router-dom';

interface VideoPreviewCardProps {
  message: Message;
  onClick: (message: Message) => void;
  className?: string;
  showTitle?: boolean;
}

export function VideoPreviewCard({ 
  message, 
  onClick, 
  className = '',
  showTitle = true
}: VideoPreviewCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  
  // Get duration in seconds from message data
  const duration = getVideoDuration(message);
  const formattedDuration = duration ? formatDuration(parseInt(duration)) : null;
  
  // Product name either from analyzed content or caption
  const productName = message.analyzed_content?.product_name || message.caption || 'Video';
  
  return (
    <div 
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <InfoCard className="border-0 p-0 bg-transparent">
        <InfoCardContent>
          {showTitle && (
            <InfoCardTitle className="text-xs">
              {productName}
            </InfoCardTitle>
          )}
          
          <InfoCardMedia
            media={[
              {
                type: "video",
                src: message.public_url,
                autoPlay: isHovering,
                loop: true,
                height: 150,
              }
            ]}
            shrinkHeight={150}
            expandHeight={200}
          />
          
          <InfoCardDescription className="mt-1 text-xs">
            {formattedDuration && (
              <span className="bg-black/70 text-white px-1.5 py-0.5 rounded text-xs mr-2">
                {formattedDuration}
              </span>
            )}
            {message.vendor_uid && (
              <span className="bg-blue-500/70 text-white px-1.5 py-0.5 rounded text-xs">
                {message.vendor_uid}
              </span>
            )}
          </InfoCardDescription>
          
          <InfoCardFooter>
            <InfoCardAction>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClick(message);
                }}
                className="text-xs flex items-center gap-1 hover:underline"
              >
                View Full <Play size={12} />
              </button>
            </InfoCardAction>
            
            <InfoCardAction>
              <Link to="#" className="flex flex-row items-center gap-1 text-xs hover:underline">
                Details <ExternalLink size={12} />
              </Link>
            </InfoCardAction>
          </InfoCardFooter>
        </InfoCardContent>
      </InfoCard>

      {/* Click overlay for the entire card */}
      <div 
        className="absolute inset-0 cursor-pointer"
        onClick={() => onClick(message)}
        aria-label={`View ${productName}`}
      />
    </div>
  );
}
