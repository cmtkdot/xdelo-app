
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

export const MediaFixButton = () => {
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResults, setRepairResults] = useState<any>(null);
  const { toast } = useToast();

  const handleRepairMedia = async () => {
    if (isRepairing) return;
    
    setIsRepairing(true);
    try {
      // Call the repair-storage-paths edge function
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { 
          fixContentDisposition: true 
        }
      });
      
      if (error) throw new Error(error.message);
      
      setRepairResults(data);
      
      toast({
        title: "Media repair completed",
        description: `Processed ${data.data.processed} files, repaired ${data.data.repaired} storage paths, fixed ${data.data.contentDispositionFixed} content types.`,
      });
    } catch (error) {
      console.error('Media repair failed:', error);
      toast({
        title: "Media repair failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Button 
      onClick={handleRepairMedia} 
      disabled={isRepairing}
      className="mb-4"
      variant="outline"
    >
      {isRepairing ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Repairing media...
        </>
      ) : repairResults ? (
        <>
          <CheckCircle className="h-4 w-4 mr-2" />
          Media repaired
        </>
      ) : (
        <>
          <UploadCloud className="h-4 w-4 mr-2" />
          Repair media files
        </>
      )}
    </Button>
  );
};
