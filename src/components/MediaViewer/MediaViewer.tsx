
import React from 'react';
import { GalleryMediaViewer } from '@/components/media-viewer/gallery/GalleryMediaViewer';
import { Message } from '@/types/entities/Message';

export interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  className?: string;
}

/**
 * MediaViewer component that delegates to the gallery implementation
 * This provides a compatibility layer for older code using this component
 */
export function MediaViewer(props: MediaViewerProps) {
  return <GalleryMediaViewer {...props} />;
}
