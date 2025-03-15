
import React from 'react';
import { MediaViewer as EnhancedMediaViewer } from '@/components/ui/media-viewer';
import { Message } from '@/types/entities/Message';

// Define component props with proper typing
interface MediaViewerProps {
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
 * MediaViewer component that delegates to the enhanced implementation
 * This provides a compatibility layer for older code using this component
 */
export function MediaViewer(props: MediaViewerProps) {
  return <EnhancedMediaViewer {...props} />;
}
