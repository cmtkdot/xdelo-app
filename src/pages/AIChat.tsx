
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { RealtimeChat } from "@/utils/RealtimeAudio";

export default function AIChat() {
  const [iframeUrl, setIframeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chat, setChat] = useState<RealtimeChat | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initChat = async () => {
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
    };

    initChat();
  }, []);

  const startVoiceChat = async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const newChat = new RealtimeChat(setIsSpeaking);
      await newChat.connect();
      setChat(newChat);
      setIsConnected(true);
      
      toast({
        title: "Connected",
        description: "Voice chat is now active",
      });
    } catch (error) {
      console.error('Error starting voice chat:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start voice chat",
        variant: "destructive",
      });
    }
  };

  const stopVoiceChat = () => {
    chat?.disconnect();
    setChat(null);
    setIsConnected(false);
    setIsSpeaking(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-start p-4 min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-[800px] mx-auto">
        {iframeUrl && (
          <iframe
            className="rounded-lg shadow-lg bg-background mb-4"
            style={{
              height: "70vh",
              width: "100%",
            }}
            src={iframeUrl}
          />
        )}
        
        <div className="flex justify-center w-full">
          {!isConnected ? (
            <Button
              onClick={startVoiceChat}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Voice Chat
            </Button>
          ) : (
            <Button
              onClick={stopVoiceChat}
              variant="secondary"
              className={isSpeaking ? "animate-pulse" : ""}
            >
              <MicOff className="w-4 h-4 mr-2" />
              End Voice Chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
