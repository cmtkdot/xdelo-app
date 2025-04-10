
import { Message } from "@/types/MessagesTypes";
import { ImageIcon } from "lucide-react";

interface MediaRendererProps {
  message: Message;
  onClick: (message: Message) => void;
}

export const MediaRenderer = ({ message, onClick }: MediaRendererProps) => {
  if (!message.public_url) {
    return (
      <div className="w-full h-full bg-muted/20 flex items-center justify-center rounded-md">
        <span className="text-xs text-muted-foreground">No media</span>
      </div>
    );
  }

  if (message.mime_type?.startsWith('video/')) {
    return (
      <div className="relative w-full h-full cursor-pointer" onClick={() => onClick(message)}>
        <video src={message.public_url} className="w-full h-full object-cover rounded-md" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
          <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
            <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
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
          onClick={() => onClick(message)}
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.svg';
            target.classList.add('bg-muted');
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="transform scale-90 group-hover:scale-100 transition-transform">
            <ImageIcon className="w-5 h-5 text-white" />
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
