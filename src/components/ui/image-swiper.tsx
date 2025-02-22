
import React from "react";
import { cn } from "@/lib/utils";
import { MediaItem } from "@/types";

interface ImageSwiperProps {
  media: MediaItem[];
  className?: string;
}

export const ImageSwiper = ({ media, className }: ImageSwiperProps) => {
  if (!media || media.length === 0) {
    return null;
  }

  const mainMedia = media[0];

  return (
    <div className={cn("relative w-full h-full", className)}>
      <img
        src={mainMedia.public_url || "/placeholder.svg"}
        alt={mainMedia.caption || "Media content"}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  );
};
