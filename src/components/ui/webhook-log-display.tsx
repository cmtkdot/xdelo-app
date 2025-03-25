
import React, { useState } from 'react';
import { Button } from './button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface WebhookLogDisplayProps {
  log: any;
  showDetails?: boolean;
}

export function WebhookLogDisplay({ log, showDetails = false }: WebhookLogDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(showDetails);

  // Safely get the summary text from the log
  const getSummaryText = () => {
    if (!log) return "No log data available";
    
    // Safely handle event_type which might be undefined
    const eventType = log.event_type || log.type || "unknown";
    const cleanEventType = typeof eventType === 'string' ? eventType.replace(/^event_/, '') : "unknown";
    
    if (log.success === false) {
      return `Failed: ${log.error || 'Unknown error'}`;
    }
    
    return log.summary || `${cleanEventType} processed successfully`;
  };

  if (!log) {
    return <div className="text-sm text-muted-foreground">No log data available</div>;
  }

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex justify-between items-center">
        <span className="font-medium">{getSummaryText()}</span>
        {(log.details || log.data) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {log.timestamp && (
            <div className="text-xs text-muted-foreground">
              {new Date(log.timestamp).toLocaleString()}
            </div>
          )}
          
          {(log.details || log.data) && (
            <pre className="mt-2 whitespace-pre-wrap text-xs p-2 bg-muted rounded-sm max-h-[200px] overflow-auto">
              {JSON.stringify(log.details || log.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
