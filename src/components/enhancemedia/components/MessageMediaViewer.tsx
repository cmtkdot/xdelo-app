
import React from 'react';
import { Message } from '@/types/entities/Message';
import { MediaViewer } from '@/components/shared/media/MediaViewer';
import { useMessageViewer } from '../hooks/useMessageViewer';
import { getMainMediaFromGroup } from '@/lib/mediaUtils';

interface MessageMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  allGroups: Message[][];
  currentIndex: number;
}

export function MessageMediaViewer({
  isOpen,
  onClose,
  currentGroup,
  allGroups,
  currentIndex
}: MessageMediaViewerProps) {
  const {
    convertToCarouselItems,
    createToolbarActions,
    previousGroup,
    nextGroup
  } = useMessageViewer();

  // Convert the current group to carousel items
  const carouselItems = convertToCarouselItems(currentGroup);
  
  // Create toolbar actions for the current group
  const toolbarActions = createToolbarActions(currentGroup);
  
  // Determine if there are previous or next groups
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allGroups.length - 1;

  // Get the main message for the details panel
  const mainMessage = getMainMediaFromGroup(currentGroup);

  // Render details panel for the side panel
  const renderDetailsPanel = () => {
    if (!mainMessage) return null;

    return (
      <div className="space-y-4">
        {mainMessage.caption && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Caption</h3>
            <p className="text-sm whitespace-pre-wrap">{mainMessage.caption}</p>
          </div>
        )}
        
        {mainMessage.analyzed_content && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Analyzed Content</h3>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40">
              {JSON.stringify(mainMessage.analyzed_content, null, 2)}
            </pre>
          </div>
        )}
        
        <div>
          <h3 className="text-lg font-semibold mb-2">Media Info</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Type:</span>
            <span>{mainMessage.mime_type || 'Unknown'}</span>
            
            {mainMessage.width && mainMessage.height && (
              <>
                <span className="text-muted-foreground">Dimensions:</span>
                <span>{mainMessage.width} x {mainMessage.height}</span>
              </>
            )}
            
            {mainMessage.file_size && (
              <>
                <span className="text-muted-foreground">Size:</span>
                <span>{(mainMessage.file_size / 1024).toFixed(2)} KB</span>
              </>
            )}
            
            {mainMessage.duration && (
              <>
                <span className="text-muted-foreground">Duration:</span>
                <span>{mainMessage.duration}s</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <MediaViewer
      isOpen={isOpen}
      onClose={onClose}
      items={carouselItems}
      onPrevious={hasPrevious ? previousGroup : undefined}
      onNext={hasNext ? nextGroup : undefined}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      toolbar={toolbarActions}
      sidePanel={renderDetailsPanel()}
    />
  );
}
