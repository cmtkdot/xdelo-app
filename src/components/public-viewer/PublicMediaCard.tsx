
import React from 'react'
import { Message } from '@/types/entities/Message'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Calendar, ImageIcon, VideoIcon } from 'lucide-react'

interface PublicMediaCardProps {
  message: Message
  onClick: () => void
  className?: string
}

export function PublicMediaCard({ message, onClick, className }: PublicMediaCardProps) {
  // Determine if the message contains a video
  const isVideo = message.mime_type?.startsWith('video/')
  
  // Get the published date
  const publishedDate = message.created_at 
    ? format(new Date(message.created_at), 'MMM d, yyyy')
    : 'Unknown date'
  
  // Get product name from caption or analyzed content
  const productName = message.analyzed_content?.product_name || message.caption || 'Unknown product'
  
  // Get vendor name
  const vendorName = message.vendor_uid || message.analyzed_content?.vendor_uid || 'Unknown vendor'
  
  return (
    <Card 
      className={cn(
        "overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200", 
        className
      )}
      onClick={onClick}
    >
      <div className="relative aspect-square">
        {/* Media thumbnail */}
        <img 
          src={message.public_url || '/placeholder.svg'} 
          alt={productName}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.svg';
          }}
        />
        
        {/* Media type indicator */}
        <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-md">
          {isVideo ? (
            <VideoIcon className="h-4 w-4" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </div>
      </div>
      
      <CardContent className="p-3">
        <h3 className="font-medium line-clamp-1 mb-1">{productName}</h3>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="line-clamp-1 mr-2">{vendorName}</span>
          
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            <span>{publishedDate}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
