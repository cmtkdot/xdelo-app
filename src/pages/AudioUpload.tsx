
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Upload, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AudioUpload() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        setAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Stop recording after 3 minutes
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
        }
      }, 180000);

      // Store mediaRecorder in window to access it from stopRecording
      (window as any).mediaRecorder = mediaRecorder;

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not access microphone. Please check permissions.",
      });
    }
  };

  const stopRecording = () => {
    const mediaRecorder = (window as any).mediaRecorder;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setAudioBlob(file);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload an audio file.",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileName = `audio-${Date.now()}.webm`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('product-audio')
        .upload(fileName, audioBlob);

      if (storageError) throw storageError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-audio')
        .getPublicUrl(fileName);

      // Create raw product entry
      const { data: entryData, error: entryError } = await supabase
        .from('raw_product_entries')
        .insert([
          {
            audio_url: publicUrl,
            processing_status: 'pending',
            needs_manual_review: true,
          }
        ])
        .select()
        .single();

      if (entryError) throw entryError;

      toast({
        title: "Success",
        description: "Audio uploaded successfully. It will be processed shortly.",
      });

      // Reset state
      setAudioBlob(null);

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "There was an error uploading your audio. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
  };

  return (
    <div className="container max-w-2xl py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audio Upload</h1>
          <p className="text-sm text-muted-foreground">
            Record or upload audio to create a new product entry.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-card">
          {!audioBlob ? (
            <div className="space-y-4 w-full">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "default"}
                className="w-full h-20"
              >
                <Mic className={`w-6 h-6 mr-2 ${isRecording ? 'animate-pulse' : ''}`} />
                {isRecording ? "Stop Recording" : "Start Recording"}
              </Button>

              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept="audio/*"
                  className="hidden"
                  id="audio-upload"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById('audio-upload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Audio File
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-between p-4 border rounded">
                <span className="text-sm">Audio ready for upload</span>
                <Button variant="ghost" size="sm" onClick={clearAudio}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
