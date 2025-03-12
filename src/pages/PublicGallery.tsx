
// Import Message from MessagesTypes explicitly 
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { MediaFixButton } from '@/components/ProductGallery/MediaFixButton';

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);

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
          // Use type assertion to convert database response to Message[]
          setMessages(data as unknown as Message[]);
          setFilteredMessages(data as unknown as Message[]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, []);

  const handleMediaClick = (message: Message) => {
    if (message.media_group_id) {
      const groupMedia = messages.filter(m => m.media_group_id === message.media_group_id);
      setSelectedMedia(groupMedia);
    } else {
      setSelectedMedia([message]);
    }
    setIsViewerOpen(true);
  };

  const renderMedia = (message: Message) => {
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
            currentGroup={selectedMedia} 
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
