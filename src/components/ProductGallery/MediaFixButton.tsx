
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';

export function MediaFixButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFixMedia = async () => {
    try {
      setIsLoading(true);
      
      // Call the repair storage paths function
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { trigger_source: 'manual_ui', force_update: true }
      });
      
      if (error) throw error;
      
      toast({
        title: "Media Repair Started",
        description: "Media repair process has been initiated successfully."
      });
      
    } catch (error: any) {
      console.error('Error initiating media repair:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to start media repair process",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleFixMedia}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Repairing...
        </>
      ) : (
        'Fix Media Paths'
      )}
    </Button>
  );
}
