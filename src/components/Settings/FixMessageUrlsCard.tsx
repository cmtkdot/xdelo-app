
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Loader2 } from 'lucide-react';

export function FixMessageUrlsCard() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFixMessageUrls = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('xdelo_fix_message_url_generation');

      if (error) {
        throw error;
      }

      setResult(data);
      
      toast({
        title: 'Message URLs Fixed',
        description: data.message || 'Message URL generation has been updated successfully',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Error fixing message URLs:', error);
      
      toast({
        title: 'Error Fixing Message URLs',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fix Message URLs</CardTitle>
        <CardDescription>
          Enhance database triggers for generating Telegram message URLs, especially for non-media messages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This utility will update the database triggers that generate message URLs for non-media messages. 
          It will also fix any missing columns in the database tables and update the processing state enum types.
        </p>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {isLoading 
              ? 'Updating triggers...' 
              : result 
                ? 'Triggers updated successfully' 
                : 'Click to update message URL triggers'}
          </span>
          <Button 
            variant="default" 
            onClick={handleFixMessageUrls}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                Fix Message URLs
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
        
        {result && (
          <div className="mt-4 p-3 bg-muted rounded-md text-sm">
            <p className="font-medium">Results:</p>
            <pre className="text-xs mt-2 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
