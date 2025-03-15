
import { MediaViewer as BaseMediaViewer } from '@/components/media-viewer/MediaViewer';
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
 * MediaViewer component that delegates to the MediaViewer implementation
 * This provides a compatibility layer for existing code
 */
export function MediaViewer(props: MediaViewerProps) {
  return <BaseMediaViewer {...props} />;
}
