
import React from "react";
import { ImageSwiper } from "@/components/ui/image-swiper";
import type { Message } from "@/types";

export interface MediaViewerProps {
  message: Message;
}

export function MediaViewer({ message }: MediaViewerProps) {
  if (!message.public_url) {
    return null;
  }

  return (
    <div className="space-y-4">
      <ImageSwiper 
        images={[
          { src: message.public_url, alt: `Message ${message.id}` }
        ]} 
      />
      {message.purchase_order && (
        <div className="text-sm text-gray-600">
          Purchase Order: {message.purchase_order.code}
        </div>
      )}
    </div>
  );
}
