'use client'

import * as React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MediaItem } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ImageSwiperProps extends React.HTMLAttributes<HTMLDivElement> {
  media: MediaItem[]
}

export function ImageSwiper({ media, className, ...props }: ImageSwiperProps) {
  const [mediaIndex, setMediaIndex] = React.useState(0)
  const dragX = useMotionValue(0)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  // Sort media to show images first
  const sortedMedia = [...media].sort((a, b) => {
    if (a.mime_type?.startsWith('image/') && !b.mime_type?.startsWith('image/')) return -1;
    if (!a.mime_type?.startsWith('image/') && b.mime_type?.startsWith('image/')) return 1;
    return 0;
  });

  const onDragEnd = () => {
    const x = dragX.get()
    if (x <= -10 && mediaIndex < sortedMedia.length - 1) {
      setMediaIndex((prev) => prev + 1)
    } else if (x >= 10 && mediaIndex > 0) {
      setMediaIndex((prev) => prev - 1)
    }
  }

  return (
    <div
      className={cn(
        'group relative aspect-square h-full w-full overflow-hidden rounded-lg',
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
              onClick={(e) => {
                e.stopPropagation();
                setMediaIndex((prev) => prev - 1);
              }}
            >
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </Button>
          </div>
        )}
        
        {mediaIndex < sortedMedia.length - 1 && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost" 
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setMediaIndex((prev) => prev + 1);
              }}
            >
              <ChevronRight className="h-4 w-4 text-neutral-600" />
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
        onClick={(e) => e.stopPropagation()}
      >
        {sortedMedia.map((item, i) => {
          const isVideo = item.mime_type?.startsWith('video/');
          return (
            <motion.div
              key={i}
              className="h-full w-full shrink-0 overflow-hidden bg-neutral-800 object-cover first:rounded-l-[inherit] last:rounded-r-[inherit]"
            >
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={item.public_url}
                  className="pointer-events-none h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img 
                  src={item.public_url} 
                  alt={item.analyzed_content?.product_name || 'Product image'}
                  className="pointer-events-none h-full w-full object-cover" 
                />
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  )
}