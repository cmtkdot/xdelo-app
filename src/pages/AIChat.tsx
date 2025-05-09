import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

export default function AIChat() {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const initChat = useCallback(async () => {
    try {
      console.log("Initializing chat session...");
      const { data, error } = await supabase.functions.invoke('create-ayd-session', {
        body: { }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log("Response from create-ayd-session:", data);
      
      if (!data?.url) {
        throw new Error('No URL returned from session creation');
      }

      setIframeUrl(data.url);
    } catch (error: any) {
      console.error('Error initializing chat:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to initialize chat. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Only initialize if we don't already have a URL
    if (!iframeUrl) {
      initChat();
    }
  }, [initChat, iframeUrl]);

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
          key={iframeUrl} // Add key to prevent unnecessary re-renders
          className="rounded-lg shadow-lg bg-background"
          style={{
            height: "80vh",
            width: "100%",
            maxWidth: "800px",
          }}
          src={iframeUrl}
          title="AI Chat Interface"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  );
}