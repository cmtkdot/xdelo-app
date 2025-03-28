
import React from 'react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Copy, Download, MoreVertical, PlayCircle } from 'lucide-react';
import { MakeEventLog } from '@/hooks/useMakeEventLogs';
import { useToast } from '@/hooks/useToast';

interface EventDetailMenuProps {
  event: MakeEventLog;
  onReplayEvent?: (event: MakeEventLog) => void;
}

const EventDetailMenu: React.FC<EventDetailMenuProps> = ({ 
  event,
  onReplayEvent 
}) => {
  const { toast } = useToast();

  const copyEventToClipboard = () => {
    try {
      const eventData = JSON.stringify(event, null, 2);
      navigator.clipboard.writeText(eventData);
      toast({
        title: "Copied to clipboard",
        description: "Event data has been copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy event data:", error);
      toast({
        title: "Copy failed",
        description: "Failed to copy event data to clipboard",
        variant: "destructive",
      });
    }
  };

  const exportEventAsJson = () => {
    try {
      const eventData = JSON.stringify(event, null, 2);
      const blob = new Blob([eventData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-${event.id}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Event data has been exported as JSON",
      });
    } catch (error) {
      console.error("Failed to export event data:", error);
      toast({
        title: "Export failed",
        description: "Failed to export event data as JSON",
        variant: "destructive",
      });
    }
  };

  const handleReplayEvent = () => {
    if (onReplayEvent) {
      onReplayEvent(event);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More options">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onReplayEvent && (
          <DropdownMenuItem onClick={handleReplayEvent}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Replay Event
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={copyEventToClipboard}>
          <Copy className="mr-2 h-4 w-4" />
          Copy to Clipboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportEventAsJson}>
          <Download className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default EventDetailMenu;
