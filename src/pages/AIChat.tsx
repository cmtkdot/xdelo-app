
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export default function AIChat() {
  const [iframeUrl, setIframeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const initChat = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-ayd-session', {
          body: { }
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No URL returned from session creation');

        setIframeUrl(data.url);
      } catch (error: any) {
        console.error('Error initializing chat:', error);
        toast({
          title: "Error",
          description: "Failed to initialize chat. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initChat();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-start p-4 min-h-[calc(100vh-4rem)]">
      {iframeUrl && (
        <iframe
          className="rounded-lg shadow-lg bg-background"
          style={{
            height: "80vh",
            width: "100%",
            maxWidth: "800px",
          }}
          src={iframeUrl}
        />
      )}
    </div>
  );
}
