
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    // Create an ephemeral token for this session
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: "You are a helpful assistant. Keep your responses concise and clear."
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create OpenAI session: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("OpenAI session created:", data);

    const { socket, response: wsResponse } = Deno.upgradeWebSocket(req);
    const openAISocket = new WebSocket(data.url);

    socket.onopen = () => {
      console.log("Client connected");
    };

    openAISocket.onopen = () => {
      console.log("Connected to OpenAI");
      // Send initial session configuration
      openAISocket.send(JSON.stringify({
        "event_id": "event_init",
        "type": "session.update",
        "session": {
          "modalities": ["text", "audio"],
          "input_audio_format": "pcm16",
          "output_audio_format": "pcm16",
          "input_audio_transcription": {
            "model": "whisper-1"
          },
          "turn_detection": {
            "type": "server_vad",
            "threshold": 0.5,
            "prefix_padding_ms": 300,
            "silence_duration_ms": 1000
          }
        }
      }));
    };

    socket.onmessage = (event) => {
      console.log("Message from client:", event.data);
      openAISocket.send(event.data);
    };

    openAISocket.onmessage = (event) => {
      console.log("Message from OpenAI:", event.data);
      socket.send(event.data);
    };

    socket.onclose = () => {
      console.log("Client disconnected");
      openAISocket.close();
    };

    openAISocket.onclose = () => {
      console.log("OpenAI connection closed");
      socket.close();
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
    };

    return wsResponse;
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
