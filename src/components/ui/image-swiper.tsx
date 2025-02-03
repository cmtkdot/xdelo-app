'use client'

import * as React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MediaItem } from '@/types'

interface ImageSwiperProps extends React.HTMLAttributes<HTMLDivElement> {
  media: MediaItem[]
}

export function ImageSwiper({ media, className, ...props }: ImageSwiperProps) {
  const [mediaIndex, setMediaIndex] = React.useState(0)
  const dragX = useMotionValue(0)

  // Filter out videos and only keep images
  const filteredMedia = React.useMemo(() => {
    return media.filter(item => item.mime_type?.startsWith('image'))
  }, [media])

  const onDragEnd = () => {
    const x = dragX.get()
    if (x <= -10 && mediaIndex < filteredMedia.length - 1) {
      setMediaIndex((prev) => prev + 1)
    } else if (x >= 10 && mediaIndex > 0) {
      setMediaIndex((prev) => prev - 1)
    }
  }

  const getMediaUrl = (item: MediaItem) => {
    if (item.public_url) return item.public_url
    return `https://ovpsyrhigencvzlxqwqz.supabase.co/storage/v1/object/public/telegram-media/${item.file_unique_id}.${item.mime_type?.split('/')[1]}`
  }

  // If no images are available, show a placeholder or return null
  if (filteredMedia.length === 0) {
    return (
      <div className="group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400">No images available</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative aspect-video h-full w-full overflow-hidden rounded-lg',
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 z-10">
        {mediaIndex > 0 && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setMediaIndex((prev) => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </Button>
          </div>
        )}
        
        {mediaIndex < filteredMedia.length - 1 && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost" 
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setMediaIndex((prev) => prev + 1)}
            >
              <ChevronRight className="h-4 w-4 text-neutral-600" />
            </Button>
          </div>
        )}

        <div className="absolute bottom-2 w-full flex justify-center">
          <div className="flex min-w-9 items-center justify-center rounded-md bg-black/80 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            {mediaIndex + 1}/{filteredMedia.length}
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
        {filteredMedia.map((item, i) => (
          <motion.div
            key={i}
            className="h-full w-full shrink-0 overflow-hidden bg-neutral-800 object-cover first:rounded-l-[inherit] last:rounded-r-[inherit]"
          >
            <img 
              src={getMediaUrl(item)} 
              alt={item.analyzed_content?.product_name || 'Product image'}
              className="pointer-events-none h-full w-full object-cover" 
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
