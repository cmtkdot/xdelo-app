
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import type { Message } from "@/types";

export default function Products() {
  const [messages, setMessages] = useState<Message[][]>([]);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        // Group messages by some criteria (e.g., date)
        const grouped = data.reduce((acc: Message[][], message: Message) => {
          const lastGroup = acc[acc.length - 1];
          if (!lastGroup || lastGroup.length >= 10) {
            acc.push([message]);
          } else {
            lastGroup.push(message);
          }
          return acc;
        }, []);

        setMessages(grouped);
      }
    };

    fetchMessages();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <div className="grid gap-4">
        {messages.map((group, i) => (
          <Card key={i} className="p-4">
            {group.map(message => (
              <div key={message.id} className="mb-2">
                {message.caption || 'No caption'}
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
