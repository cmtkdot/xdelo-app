'use client'

import * as React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaItem } from '@/types'
import { cn } from '@/lib/utils'

interface ImageSwiperProps extends React.HTMLAttributes<HTMLDivElement> {
  media: MediaItem[]
}

export function ImageSwiper({ media, className, ...props }: ImageSwiperProps) {
  const [mediaIndex, setMediaIndex] = React.useState(0)
  const [isHovered, setIsHovered] = React.useState(false)
  const [previousIndex, setPreviousIndex] = React.useState(0)
  const [manualNavigation, setManualNavigation] = React.useState(false)
  const dragX = useMotionValue(0)
  const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([])

  // Sort media to show images first, then videos
  const sortedMedia = React.useMemo(() => {
    return [...media].sort((a, b) => {
      const aIsImage = a.mime_type?.startsWith('image') || false
      const bIsImage = b.mime_type?.startsWith('image') || false
      return bIsImage ? 1 : aIsImage ? -1 : 0
    })
  }, [media])

  const findFirstVideoIndex = React.useCallback(() => {
    return sortedMedia.findIndex(item => item.mime_type?.startsWith('video'))
  }, [sortedMedia])

  const onDragEnd = () => {
    const x = dragX.get()
    if (x <= -10 && mediaIndex < sortedMedia.length - 1) {
      setMediaIndex((prev) => prev + 1)
      setManualNavigation(true)
    } else if (x >= 10 && mediaIndex > 0) {
      setMediaIndex((prev) => prev - 1)
      setManualNavigation(true)
    }
  }

  const getMediaUrl = (item: MediaItem) => {
    if (item.public_url) return item.public_url
    return `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${item.file_unique_id}.${item.mime_type?.split('/')[1]}`
  }

  React.useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (isHovered && index === mediaIndex && sortedMedia[index].mime_type?.startsWith('video')) {
          video.play().catch(() => {
            // Handle autoplay failure silently
          })
        } else {
          video.pause()
          video.currentTime = 0
        }
      }
    })
  }, [isHovered, mediaIndex, sortedMedia])

  const handleMouseEnter = React.useCallback(() => {
    setIsHovered(true)
    setPreviousIndex(mediaIndex)
    
    if (!manualNavigation) {
      const firstVideoIndex = findFirstVideoIndex()
      if (firstVideoIndex !== -1 && !sortedMedia[mediaIndex].mime_type?.startsWith('video')) {
        setMediaIndex(firstVideoIndex)
      }
    }
  }, [findFirstVideoIndex, mediaIndex, sortedMedia, manualNavigation])

  const handleMouseLeave = React.useCallback(() => {
    setIsHovered(false)
    setManualNavigation(false)
    if (sortedMedia[mediaIndex].mime_type?.startsWith('video')) {
      setMediaIndex(previousIndex)
    }
  }, [mediaIndex, previousIndex, sortedMedia])

  const handleButtonClick = (e: React.MouseEvent, newIndex: number) => {
    e.stopPropagation()
    setPreviousIndex(mediaIndex)
    setMediaIndex(newIndex)
    setManualNavigation(true)
  }

  if (!sortedMedia?.length) {
    return (
      <div className="group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400">No media available</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-black/90',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 z-10">
        {mediaIndex > 0 && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-black/50 hover:bg-black/75 text-white opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => handleButtonClick(e, mediaIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
        {mediaIndex < sortedMedia.length - 1 && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-black/50 hover:bg-black/75 text-white opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => handleButtonClick(e, mediaIndex + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="absolute bottom-2 w-full flex justify-center">
          <div className="flex min-w-9 items-center justify-center rounded-md bg-black/80 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            {mediaIndex + 1}/{sortedMedia.length}
          </div>
        </div>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{
          left: 0,
          right: 0
        }}
        dragMomentum={false}
        style={{
          x: dragX
        }}
        animate={{
          translateX: `-${mediaIndex * 100}%`
        }}
        onDragEnd={onDragEnd}
        transition={{ damping: 18, stiffness: 90, type: 'spring', duration: 0.2 }}
        className="flex h-full cursor-grab items-center rounded-[inherit] active:cursor-grabbing"
      >
        {sortedMedia.map((item, i) => {
          const isVideo = item.mime_type?.startsWith('video')
          const mediaUrl = getMediaUrl(item)

          return (
            <motion.div
              key={i}
              className="h-full w-full shrink-0 overflow-hidden bg-neutral-800 object-cover first:rounded-l-[inherit] last:rounded-r-[inherit]"
            >
              {isVideo ? (
                <video
                  ref={el => videoRefs.current[i] = el}
                  src={mediaUrl}
                  className="pointer-events-none h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img 
                  src={mediaUrl} 
                  alt={item.analyzed_content?.product_name || 'Product image'}
                  className="pointer-events-none h-full w-full object-cover" 
                />
              )}
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}