
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WebhookLogDisplayProps {
  logs: Array<{
    id?: string;
    timestamp?: string;
    event_type?: string;
    status?: string;
    message?: string;
    error?: string;
    [key: string]: any;
  }>;
  maxHeight?: string;
  title?: string;
  emptyMessage?: string;
}

/**
 * A component to display webhook logs with proper formatting
 */
export function WebhookLogDisplay({
  logs,
  maxHeight = '300px',
  title = 'Recent Logs',
  emptyMessage = 'No logs to display'
}: WebhookLogDisplayProps) {
  if (!logs || logs.length === 0) {
    return (
      <Card className="p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground text-center">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ScrollArea className={`max-h-[${maxHeight}]`}>
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div key={log.id || index} className="text-xs border rounded-md p-2">
              <div className="flex justify-between items-start mb-1">
                <div>
                  {log.event_type && (
                    <Badge variant="outline" className="mr-2">
                      {log.event_type}
                    </Badge>
                  )}
                  {log.status && (
                    <Badge 
                      variant={log.status === 'error' ? 'destructive' : 
                               log.status === 'completed' ? 'success' : 'secondary'}>
                      {log.status}
                    </Badge>
                  )}
                </div>
                {log.timestamp && (
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                )}
              </div>
              
              {log.message && (
                <p className="mb-1 break-words">{log.message}</p>
              )}
              
              {log.error && (
                <div className="bg-destructive/10 p-1 rounded mt-1 text-destructive break-words">
                  {log.error}
                </div>
              )}
              
              {log.metadata && typeof log.metadata === 'object' && (
                <details className="mt-1">
                  <summary className="text-muted-foreground cursor-pointer">Details</summary>
                  <pre className="text-xs bg-muted p-1 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
