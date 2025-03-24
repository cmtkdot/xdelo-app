
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useMediaGroups } from '@/hooks/useMediaGroups';
import { Message } from '@/types/entities/Message';
import { PublicMediaCard } from '@/components/public-viewer/PublicMediaCard';
import { PublicMediaViewer } from '@/components/public-viewer/PublicMediaViewer';
import { usePublicViewer } from '@/components/public-viewer/hooks/usePublicViewer';

const PublicGallery = () => {
  const { id } = useParams();
  const { data: messageGroups, isLoading, refetch } = useMediaGroups();
  const [filteredGroups, setFilteredGroups] = useState<Message[][]>([]);
  
  // Setup the media viewer
  const {
    isOpen,
    currentGroup,
    openViewer,
    closeViewer,
    goToNextGroup,
    goToPreviousGroup,
    hasNext,
    hasPrevious
  } = usePublicViewer(filteredGroups);

  // Apply initial filtering based on URL params
  useEffect(() => {
    if (!messageGroups || messageGroups.length === 0) return;
    
    // If there's an ID parameter, filter by that ID
    if (id && id !== 'public') {
      const filtered = messageGroups.filter(group => {
        return group.some(item => 
          item.vendor_uid === id || 
          item.product_code === id || 
          item.product_name?.toLowerCase().includes(id.toLowerCase())
        );
      });
      setFilteredGroups(filtered);
    } else {
      // If no ID or it's 'public', show all
      setFilteredGroups(messageGroups);
    }
  }, [messageGroups, id]);

  // Handle opening the viewer for a specific message
  const handleOpenViewer = (message: Message) => {
    // Find the group that contains this message
    const group = filteredGroups.find(g => 
      g.some(item => item.id === message.id)
    ) || [message];
    
    // Find the index of the message within its group
    const messageIndex = group.findIndex(item => item.id === message.id);
    
    // Open the viewer with the found group and message index
    openViewer(group, messageIndex >= 0 ? messageIndex : 0);
  };

  return (
    <DashboardLayout title="Public Gallery">
      <div className="container mx-auto">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold">
              {id && id !== 'public' ? `Gallery: ${id}` : 'Public Gallery'}
            </h1>
          </div>
          
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse bg-muted rounded-md" />
              ))}
            </div>
          ) : filteredGroups.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredGroups.map((group) => (
                <PublicMediaCard 
                  key={group[0].id} 
                  message={group[0]} 
                  onClick={handleOpenViewer}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No media items found</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Media Viewer */}
      <PublicMediaViewer 
        isOpen={isOpen}
        onClose={closeViewer}
        currentGroup={currentGroup}
        onPrevious={goToPreviousGroup}
        onNext={goToNextGroup}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onDelete={async (id) => {
          await refetch();
          return Promise.resolve();
        }}
      />
    </DashboardLayout>
  );
};

export default PublicGallery;
