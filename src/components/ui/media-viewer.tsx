import { MediaViewer as BaseMediaViewer } from '@/components/media-viewer/MediaViewer';
import type { MediaViewerProps } from '@/components/media-viewer/MediaViewer';

export type { MediaViewerProps };

/**
 * MediaViewer component that delegates to the MediaViewer implementation
 * This provides a compatibility layer for existing code
 */
export function MediaViewer(props: MediaViewerProps) {
  return <BaseMediaViewer {...props} />;
}
