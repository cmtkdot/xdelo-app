import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Upload, X, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AudioEntry {
  id: string;
  audio_url: string;
  created_at: string;
  processing_status: 'pending' | 'processing' | 'processed' | 'failed';
  extracted_data: {
    transcription?: string;
    confidence?: number;
  } | null;
  needs_manual_review: boolean;
}

export default function AudioUpload() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch audio entries
  const { data: entries, isLoading } = useQuery({
    queryKey: ['audio-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_product_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AudioEntry[];
    }
  });

  // Approve entry mutation
  const approveMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('raw_product_entries')
        .update({ 
          needs_manual_review: false,
          processing_status: 'processed'
        })
        .eq('id', entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audio-entries'] });
      toast({
        title: "Entry approved",
        description: "The audio entry has been approved.",
      });
    }
  });

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

      // Call the processing function
      const response = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/process-audio-upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ entryId: entryData.id }),
        }
      );

      if (!response.ok) {
        throw new Error('Processing failed');
      }

      toast({
        title: "Success",
        description: "Audio uploaded successfully. It will be processed shortly.",
      });

      // Reset state
      setAudioBlob(null);
      queryClient.invalidateQueries({ queryKey: ['audio-entries'] });

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
    <div className="container max-w-4xl py-10">
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
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transcription</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : entries?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      entry.processing_status === 'processed' ? 'bg-green-100 text-green-800' :
                      entry.processing_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      entry.processing_status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {entry.processing_status}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {entry.extracted_data?.transcription || "Processing..."}
                  </TableCell>
                  <TableCell>
                    {entry.needs_manual_review && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => approveMutation.mutate(entry.id)}
                        disabled={approveMutation.isPending}
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span className="ml-2">Approve</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
