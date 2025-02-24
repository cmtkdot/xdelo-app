
import React from "react";
import { Card } from "@/components/ui/card";

export interface ImageSwiperProps {
  images: {
    src: string;
    alt: string;
  }[];
}

export function ImageSwiper({ images }: ImageSwiperProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const previousImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="aspect-video relative">
        <img
          src={images[currentIndex].src}
          alt={images[currentIndex].alt}
          className="w-full h-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={previousImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
            >
              ←
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
            >
              →
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
