
import { GalleryMediaViewer } from '@/components/media-viewer/gallery/GalleryMediaViewer';
import type { Message } from '@/types';

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
 * MediaViewer component that delegates to the GalleryMediaViewer
 * This provides a compatibility layer for existing code
 */
export function MediaViewer(props: MediaViewerProps) {
  return <GalleryMediaViewer {...props} />;
}
