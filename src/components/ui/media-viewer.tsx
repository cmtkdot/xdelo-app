
import { PublicMediaViewer } from '@/components/public-viewer/PublicMediaViewer';
import type { MediaViewerProps } from '@/components/public-viewer/PublicMediaViewer';

export type { MediaViewerProps };

/**
 * MediaViewer component that delegates to the PublicMediaViewer implementation
 * This provides a compatibility layer for existing code
 */
export function MediaViewer(props: MediaViewerProps) {
  return <PublicMediaViewer {...props} />;
}
