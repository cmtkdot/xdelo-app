// Import Message from MessagesTypes explicitly 
import { Message as MessageTypeFromMessages } from "@/types/MessagesTypes";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { MediaFixButton } from '@/components/ProductGallery/MediaFixButton';

const PublicGallery = () => {
  const [messages, setMessages] = useState<MessageTypeFromMessages[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<MessageTypeFromMessages[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MessageTypeFromMessages[]>([]);

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .limit(50);

        if (error) {
          console.error("Error fetching messages:", error);
        }

        if (data) {
          setMessages(data as MessageTypeFromMessages[]);
          setFilteredMessages(data as MessageTypeFromMessages[]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, []);

  const handleMediaClick = (message: MessageTypeFromMessages) => {
    if (message.media_group_id) {
      const groupMedia = messages.filter(m => m.media_group_id === message.media_group_id);
      setSelectedMedia(groupMedia);
    } else {
      setSelectedMedia([message]);
    }
    setIsViewerOpen(true);
  };

  const renderMedia = (message: MessageTypeFromMessages) => {
    if (!message.public_url) return null;

    if (message.mime_type?.startsWith('video/')) {
      return (
        <div className="relative w-32 h-32 cursor-pointer" onClick={() => handleMediaClick(message)}>
          <video src={message.public_url} className="w-full h-full object-cover rounded-md" />
        </div>
      );
    }

    return (
      <img
        src={message.public_url}
        alt={message.caption || 'Media'}
        className="w-32 h-32 object-cover rounded-md cursor-pointer"
        onClick={() => handleMediaClick(message)}
      />
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Public Gallery</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMessages.map(message => (
              <div key={message.id} className="border rounded-md p-2">
                {renderMedia(message)}
                <p className="text-sm mt-2">{message.caption || 'No caption'}</p>
              </div>
            ))}
          </div>

          <MediaViewer 
            isOpen={isViewerOpen} 
            onClose={() => setIsViewerOpen(false)} 
            currentGroup={selectedMedia as MessageTypeFromMessages[]} 
          />

          <div className="mt-4">
            <MediaFixButton messages={messages} />
          </div>
        </>
      )}
    </div>
  );
};

export default PublicGallery;
