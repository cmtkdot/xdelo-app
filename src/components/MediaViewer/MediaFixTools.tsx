
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMediaFix } from '@/hooks/useMediaFix';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Message } from '@/types';

interface MediaFixToolsProps {
  messages: Message[] | Message[][];
  onSuccess?: () => void;
}

export const MediaFixTools = ({ messages, onSuccess }: MediaFixToolsProps) => {
  const { isFixing, batchFixContentDisposition, runAutoFix } = useMediaFix();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Flatten message array if it's in groups
  const flattenMessages = (): Message[] => {
    if (!messages.length) return [];
    
    // Check if it's already a flat array
    if (!Array.isArray(messages[0])) {
      return messages as Message[];
    }
    
    // Flatten array of arrays
    return (messages as Message[][]).flat();
  };

  const fixCurrentlyViewedMessages = async () => {
    const messagesToFix = flattenMessages();
    if (!messagesToFix.length) {
      setStatus('error');
      setStatusMessage('No messages to fix');
      return;
    }

    try {
      setStatus('idle');
      setStatusMessage('Fixing content disposition for displayed messages...');
      
      const messageIds = messagesToFix.map(m => m.id);
      const result = await batchFixContentDisposition(messageIds);
      
      if (result.success) {
        setStatus('success');
        setStatusMessage(`Fixed ${result.results.filter((r: any) => r.success).length} out of ${messageIds.length} messages`);
        if (onSuccess) onSuccess();
      } else {
        setStatus('error');
        setStatusMessage(result.message || 'Failed to fix messages');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const runAutoFixProcess = async () => {
    try {
      setStatus('idle');
      setStatusMessage('Auto-fixing media display issues...');
      
      const result = await runAutoFix(100);
      
      if (result.success) {
        setStatus('success');
        setStatusMessage(`Auto-fixed ${result.results.filter((r: any) => r.success).length} messages`);
        if (onSuccess) onSuccess();
      } else {
        setStatus('error');
        setStatusMessage(result.message || 'Failed to run auto-fix');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Fix Media Display Issues</h3>
      
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="secondary" 
          onClick={fixCurrentlyViewedMessages} 
          disabled={isFixing || !messages.length}
        >
          {isFixing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <AlertCircle className="w-4 h-4 mr-2" />
          )}
          Fix Current Messages
        </Button>
        
        <Button 
          variant="outline" 
          onClick={runAutoFixProcess}
          disabled={isFixing}
        >
          {isFixing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Run Auto-Fix (100)
        </Button>
      </div>
      
      {statusMessage && (
        <div className={`mt-2 text-sm p-2 rounded ${
          status === 'error' 
            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' 
            : status === 'success' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
        }`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
};
