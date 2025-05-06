import React, { useEffect, useRef, useState } from 'react'
import { Message } from '@/types/entities/Message'
import { Play, Eye, Pencil, Trash, Image as ImageIcon, FileText } from 'lucide-react'
import { useVideoThumbnail } from '@/hooks/useVideoThumbnail'
import { isVideoMessage } from '@/utils/mediaUtils'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'
import { MediaEditDialog } from '@/components/MediaEditDialog/MediaEditDialog'
import { DeleteMessageDialog } from '@/components/shared/DeleteMessageDialog'
import { useTelegramOperations } from '@/hooks/useTelegramOperations'

interface PublicMediaCardProps {
  message: Message
  onClick: (message: Message) => void
}

// Function to format video duration in mm:ss format
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// Helper function to get image dimensions, prefixed with _ as currently unused
function _getImageDimensions(img: HTMLImageElement): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
  });
}

export const PublicMediaCard: React.FC<PublicMediaCardProps> = ({ message, onClick }) => {
  const [isHovering, setIsHovering] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [imageError, setImageError] = useState(false);
  
  // Use the video thumbnail hook to generate thumbnails for videos
  const { thumbnailUrl, isLoading, generateThumbnail } = useVideoThumbnail(message)
  
  // Debug message data
  useEffect(() => {
    if (!message || !message.id) {
      console.warn("PublicMediaCard received invalid message:", message);
    }
  }, [message]);
  
  // Auto-generate thumbnail for videos on component mount with debouncing
  useEffect(() => {
    // Skip if not a video or if we already have a thumbnail or are currently generating one
    if (!isVideoMessage(message) || thumbnailUrl || isLoading) return;
    
    // Add a slight delay to avoid too many simultaneous thumbnail generations
    const timeoutId = setTimeout(() => {
      generateThumbnail();
    }, 100 * (Math.floor(Math.random() * 10) + 1)); // Random delay between 100-1000ms
    
    return () => clearTimeout(timeoutId);
  }, [message.id, thumbnailUrl, isLoading, generateThumbnail])
  
  // Handle video hover playback with better error handling
  useEffect(() => {
    if (!videoRef.current || !isVideoMessage(message)) return;
    
    if (isHovering) {
      // Add a small delay to ensure UI updates first
      const timeoutId = setTimeout(() => {
        if (videoRef.current) {
          // Reset to beginning for consistent preview
          videoRef.current.currentTime = 0;
          
          // Try to play with proper error handling
          try {
            const playPromise = videoRef.current.play();
            
            if (playPromise !== undefined) {
              playPromise.catch(err => {
                // Just log the error, the static thumbnail will still be visible
                console.warn('Video autoplay blocked (this is normal):', err);
              });
            }
          } catch (err) {
            console.warn('Video playback error:', err);
          }
        }
      }, 50);
      
      return () => clearTimeout(timeoutId);
    } else if (videoRef.current) {
      // Pause when not hovering
      videoRef.current.pause();
    }
  }, [isHovering, message]);

  const { deleteMessage, isDeleting } = useTelegramOperations();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Clear visual feedback that the card was clicked
    const target = e.currentTarget as HTMLElement
    target.classList.add('ring-2', 'ring-primary')
    
    // Call the onClick handler with the message
    if (onClick) {
      onClick(message)
      
      // Remove visual feedback after a delay
      setTimeout(() => {
        target.classList.remove('ring-2', 'ring-primary')
      }, 300)
    }
  }
  
  // Not currently used but keeping for future implementation
  const _openTelegramLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const chatId = message.chat_id?.toString().replace('-100', '')
    const messageId = message.telegram_message_id
    
    if (chatId && messageId) {
      window.open(`https://t.me/c/${chatId}/${messageId}`, '_blank')
    }
  }
  
  const handleTabSelect = (index: number | null) => {
    if (index === null) return
    
    switch (index) {
      case 0: // View
        onClick(message)
        break
      case 1: // Edit
        setIsEditDialogOpen(true)
        break
      case 2: // Delete
        setIsDeleteDialogOpen(true)
        break
    }
  }
  
  const handleDeleteConfirm = async (deleteTelegram: boolean) => {
    try {
      await deleteMessage(message, deleteTelegram);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }
  
  const tabs = [
    { title: "View", icon: Eye },
    { title: "Edit", icon: Pencil },
    { title: "Delete", icon: Trash }
  ]
  
  // Format date in MM/DD/YYYY format for hover state
  const compactDate = message.purchase_date 
    ? new Date(message.purchase_date).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      })
    : null
    
  // Format date for default state with month name
  const formattedDate = message.purchase_date 
    ? new Date(message.purchase_date).toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : null

  // Get color based on vendor UID to create consistent color coding
  const getVendorColor = (vendorUid: string) => {
    // Simple hash function to generate a consistent color for the same vendor
    const hash = vendorUid.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)
    
    // List of predefined colors for better visual appearance
    const colors = [
      'bg-blue-500/70', 'bg-emerald-500/70', 'bg-amber-500/70',
      'bg-indigo-500/70', 'bg-pink-500/70', 'bg-teal-500/70',
      'bg-orange-500/70', 'bg-violet-500/70', 'bg-lime-500/70'
    ]
    
    // Return a consistent color from the predefined list
    return colors[Math.abs(hash) % colors.length]
  }

  // Get ring color to match the vendor badge
  const getVendorRingColor = (vendorUid: string) => {
    // Similar logic but for the ring color
    const hash = vendorUid.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)
    
    const colors = [
      'ring-blue-500/20', 'ring-emerald-500/20', 'ring-amber-500/20',
      'ring-indigo-500/20', 'ring-pink-500/20', 'ring-teal-500/20',
      'ring-orange-500/20', 'ring-violet-500/20', 'ring-lime-500/20'
    ]
    
    return colors[Math.abs(hash) % colors.length]
  }
  
  const vendorBgColor = message.vendor_uid ? getVendorColor(message.vendor_uid) : 'bg-purple-500/70'
  const vendorRingColor = message.vendor_uid ? getVendorRingColor(message.vendor_uid) : 'ring-purple-500/20'

  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const isVideo = isVideoMessage(message) || 
    (message.public_url && (
      message.public_url.endsWith('.mp4') || 
      message.public_url.endsWith('.mov') ||
      message.public_url.endsWith('.webm') ||
      message.public_url.endsWith('.avi')
    ))

  return (
    <div 
      className={`relative group cursor-pointer overflow-hidden rounded-md aspect-square shadow-sm transition-all hover:shadow-md
        ${isHovering ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/30'}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleClick}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
          <div className="w-5 h-5 border-2 rounded-full border-primary border-l-transparent animate-spin"></div>
        </div>
      )}
      
      {/* Image */}
      {!isVideo && message.public_url && !imageError && (
        <img
          src={message.public_url}
          alt={message.caption || "Media"}
          className="object-cover w-full h-full"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      )}
      
      {/* Fallback if image fails to load */}
      {!isVideo && (imageError || !message.public_url) && (
        <div className="flex items-center justify-center w-full h-full bg-muted">
          <ImageIcon className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      
      {/* Video */}
      {isVideo && (
        <>
          {/* Video preview */}
          <video
            ref={videoRef}
            src={message.public_url}
            poster={thumbnailUrl}
            muted
            loop
            playsInline
            className="object-cover w-full h-full"
            onError={() => setImageError(true)}
          />
          
          {/* Thumbnail fallback */}
          {(!message.public_url || imageError) && !thumbnailUrl && (
            <div className="flex items-center justify-center w-full h-full bg-muted">
              <Play className="w-10 h-10 text-muted-foreground" />
            </div>
          )}
          
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-2 bg-black/50 rounded-full">
              <Play className="w-6 h-6 text-white" fill="white" />
            </div>
          </div>
        </>
      )}
      
      {/* Caption overlay at bottom */}
      {message.caption && (
        <div className="absolute bottom-0 left-0 right-0 p-2 text-xs bg-black/60 text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
          {message.caption}
        </div>
      )}
      
      {/* Vendor UID Tag (Top Right) */}
      {message.vendor_uid && (
        <div className="absolute top-2 right-2 z-10">
          <span className={`inline-flex items-center rounded-full ${vendorBgColor} backdrop-blur-sm px-2 py-1 text-xs font-medium text-white shadow-sm ring-1 ring-inset ${vendorRingColor}`}>
            {message.vendor_uid}
          </span>
        </div>
      )}

      {/* Default State: Product Name and Date */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            {message.product_name && (
              <div className="text-white text-sm font-medium line-clamp-1">
                {message.product_name}
              </div>
            )}
          </div>
          
          {formattedDate && (
            <div className="text-white/80 text-xs ml-2">
              {formattedDate}
            </div>
          )}
        </div>
      </div>
      
      {/* Hover State: Bottom Bar (only visible on hover) */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
        <div className="flex items-center gap-2">
          {/* Product Name */}
          <div className="flex-1">
            {message.product_name && (
              <span className="text-white text-sm font-medium line-clamp-1">
                {message.product_name}
              </span>
            )}
          </div>
          
          {/* Date and Quantity in right column */}
          <div className="flex flex-col items-end">
            {compactDate && (
              <span className="text-white/80 text-xs">
                {compactDate}
              </span>
            )}
            {message.product_quantity && (
              <span className="text-white/90 text-xs whitespace-nowrap">
                Qty: {message.product_quantity}
              </span>
            )}
          </div>
        </div>
        
        {/* Product code pill using vendor color scheme */}
        {message.product_code && (
          <div className="mt-2">
            <span className={`inline-flex items-center rounded-md ${vendorBgColor} px-1.5 py-0.5 text-xs font-medium text-white shadow-sm ring-1 ring-inset ${vendorRingColor}`}>
              PO#{message.product_code}
            </span>
          </div>
        )}
      </div>
      
      {/* Centered Tabs - Only visible on hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-30">
        <div className="pointer-events-auto">
          <ExpandableTabs 
            tabs={tabs} 
            activeColor="text-white"
            className="border-white/20 bg-black/80 backdrop-blur-md shadow-lg p-0.5 scale-[0.85] border-[1.5px]"
            onChange={handleTabSelect}
          />
        </div>
      </div>
      
      {/* Modals/Dialogs */}
      <MediaEditDialog
        media={{ id: message.id, caption: message.caption, media_group_id: message.media_group_id }}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => setIsEditDialogOpen(false)}
      />
      
      <DeleteMessageDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        messageToDelete={message}
        onConfirm={handleDeleteConfirm}
        isProcessing={isDeleting}
      />
    </div>
  )
}