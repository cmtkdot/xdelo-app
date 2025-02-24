
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';

export default function Products() {
  const [mediaGroups, setMediaGroups] = useState<Message[][]>([]);

  const { data: messages } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data: rawData, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const messages = (rawData || []).map(message => ({
        ...message,
        analyzed_content: message.analyzed_content as Message['analyzed_content'],
      })) as Message[];

      // Group messages by media_group_id
      const groups = messages.reduce((acc: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(message);
        return acc;
      }, {});

      const groupedMessages = Object.values(groups);
      setMediaGroups(groupedMessages);
      return messages;
    }
  });

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Products</h1>
      {/* Add your product display logic here */}
    </div>
  );
}
