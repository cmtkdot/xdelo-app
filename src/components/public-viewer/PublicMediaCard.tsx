import React, { useEffect, useRef, useState } from 'react'
import { Message } from '@/types/entities/Message'
import { Button } from '@/components/ui/button'
import { ExternalLink, Video, Play, Eye, Pencil, Trash } from 'lucide-react'
import { useVideoThumbnail } from '@/hooks/useVideoThumbnail'
import { getVideoDuration, isVideoMessage } from '@/utils/mediaUtils'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'
import { MediaEditDialog } from '@/components/MediaEditDialog/MediaEditDialog'
import { DeleteConfirmationDialog } from '@/components/MessagesTable/TableComponents/DeleteConfirmationDialog'

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

export function PublicMediaCard({ message, onClick }: PublicMediaCardProps) {
  const isVideo = isVideoMessage(message)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Use the video thumbnail hook to generate thumbnails for videos
  const { thumbnailUrl, isLoading, hasError, generateThumbnail } = useVideoThumbnail(message)
  
  // Auto-generate thumbnail for videos on component mount
  useEffect(() => {
    if (isVideo && !thumbnailUrl && !isLoading) {
      generateThumbnail()
    }
  }, [isVideo, message.id, thumbnailUrl, isLoading, generateThumbnail])
  
  // Handle video playback on hover
  useEffect(() => {
    const video = videoRef.current
    if (video && isVideo) {
      if (isHovering) {
        // Start playing when hovering
        video.play().catch(err => {
          console.error('Error autoplaying video:', err)
        })
      } else {
        // Pause and reset to beginning when not hovering
        video.pause()
        video.currentTime = 0
      }
    }
  }, [isHovering, isVideo])
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Clear visual feedback that the card was clicked
    const target = e.currentTarget as HTMLElement
    target.classList.add('ring-2', 'ring-primary')
    
    console.log(`PublicMediaCard: Card clicked for message ${message.id}`)
    
    // Call the onClick handler with the message
    if (onClick) {
      console.log(`PublicMediaCard: Calling onClick handler for message ${message.id}`)
      onClick(message)
      
      // Remove visual feedback after a delay
      setTimeout(() => {
        target.classList.remove('ring-2', 'ring-primary')
      }, 300)
    }
  }
  
  const openTelegramLink = (e: React.MouseEvent) => {
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
    console.log(`Deleting message ${message.id}, delete from telegram: ${deleteTelegram}`)
    // Implement delete functionality
    setIsDeleteDialogOpen(false)
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

  return (
    <div 
      className="group relative overflow-hidden rounded-lg bg-background border shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${message.product_name || 'media item'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e as unknown as React.MouseEvent)
        }
      }}
    >
      {/* Vendor UID Tag (Top Right) */}
      {message.vendor_uid && (
        <div className="absolute top-2 right-2 z-10">
          <span className={`inline-flex items-center rounded-full ${vendorBgColor} backdrop-blur-sm px-2 py-1 text-xs font-medium text-white shadow-sm ring-1 ring-inset ${vendorRingColor}`}>
            {message.vendor_uid}
          </span>
        </div>
      )}

      {/* Media Type Tag (Top Left) with glassmorphism */}
      <div className="absolute top-2 left-2 z-10">
        <div className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-white/90 text-xs italic font-light">
          {isVideo ? 'Video' : 'Image'}
        </div>
      </div>

      {/* Media content */}
      <div className="aspect-square overflow-hidden bg-muted/20">
        {isVideo ? (
          <div className="relative w-full h-full bg-black">
            {/* Thumbnail image (shown while not hovering) */}
            {!isHovering && (
              <img
                src={thumbnailUrl || message.public_url}
                alt={message.product_name || "Video thumbnail"}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => console.error('Error loading video thumbnail')}
              />
            )}
            
            {/* Autoplay video (plays on hover) */}
            <video
              ref={videoRef}
              src={message.public_url}
              className={`w-full h-full object-cover ${isHovering ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
              playsInline
              muted
              loop
              preload="metadata"
            />
            
            {/* Video Play Overlay - only show when not hovering */}
            {!isHovering && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                <div className="rounded-full bg-black/40 p-3 backdrop-blur-sm border border-white/20 transform group-hover:scale-110 transition-transform duration-300 shadow-xl">
                  <Play className="h-8 w-8 text-white" fill="white" />
                </div>
              </div>
            )}
            
            {/* Duration badge if available */}
            {message.duration && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur-sm">
                {formatDuration(message.duration)}
              </div>
            )}
          </div>
        ) : (
          <img
            src={message.public_url}
            alt={message.product_name || "Image"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
      </div>
      
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
          {/* Product Name and Quantity in one row */}
          <div className="flex-1 flex items-center gap-2">
            {message.product_name && (
              <span className="text-white text-sm font-medium line-clamp-1">
                {message.product_name}
              </span>
            )}
            
            {message.product_quantity && (
              <span className="text-white/90 text-xs whitespace-nowrap">
                Qty: {message.product_quantity}
              </span>
            )}
          </div>
          
          {/* Compact date */}
          {compactDate && (
            <span className="text-white/80 text-xs">
              {compactDate}
            </span>
          )}
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
        onSuccess={() => console.log("Caption updated successfully")}
      />
      
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        messageToDelete={message as any}
        onConfirm={handleDeleteConfirm}
        isProcessing={false}
      />
    </div>
  )
}