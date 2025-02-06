
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { RealtimeChat } from "@/utils/RealtimeAudio";

export default function AIChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chat, setChat] = useState<RealtimeChat | null>(null);
  const { toast } = useToast();

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

  return (
    <div className="flex flex-col justify-center items-center min-h-[calc(100vh-4rem)] p-4">
      <div className="w-full max-w-[800px] mx-auto">
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
