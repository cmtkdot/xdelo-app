
import React from "react";
import { Message } from "@/types/MessagesTypes";
import { cn } from "@/lib/utils";

interface MediaRendererProps {
  message: Message;
  onClick: () => void;
  className?: string;
}

export const MediaRenderer: React.FC<MediaRendererProps> = ({ 
  message, 
  onClick,
  className 
}) => {
  if (!message.public_url) {
    return (
      <div className={cn(
        "w-full h-full bg-muted/20 flex items-center justify-center rounded-md",
        className
      )}>
        <span className="text-xs text-muted-foreground">No media</span>
      </div>
    );
  }

  if (message.mime_type?.startsWith('video/')) {
    return (
      <div className="relative w-full h-full cursor-pointer" onClick={onClick}>
        <video src={message.public_url} className="w-full h-full object-cover rounded-md" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/80 flex items-center justify-center">
            <svg className="w-4 h-4 md:w-6 md:h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"></path>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  if (message.mime_type?.startsWith('image/')) {
    return (
      <div className="relative w-full h-full group">
        <img
          src={message.public_url}
          alt={message.caption || 'Media'}
          className="w-full h-full object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onClick}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.svg';
            target.classList.add('bg-muted');
          }}
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="transform scale-90 group-hover:scale-100 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-6 md:h-6 text-white">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-muted/20 flex items-center justify-center rounded-md">
      <span className="text-xs text-muted-foreground">{message.mime_type || 'Unknown type'}</span>
    </div>
  );
};
