
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface WebhookLogDisplayProps {
  logs: any[];
  showDetails?: boolean;
}

export function WebhookLogDisplay({ logs, showDetails = false }: WebhookLogDisplayProps) {
  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-muted">
      <CardContent className="p-3">
        <h4 className="text-sm font-medium mb-2">Webhook Logs</h4>
        <ScrollArea className="h-48">
          {logs.map((log, index) => (
            <div key={index} className="mb-2 text-xs border-b border-muted pb-2 last:border-b-0 last:pb-0">
              <div className="flex justify-between items-start">
                <div>
                  {log.timestamp && (
                    <span className="text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  )}
                  <p className="font-medium">{log.message || log.summary || 'Log entry'}</p>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  log.level === 'ERROR' || log.level === 'error'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                }`}>
                  {log.level || 'INFO'}
                </span>
              </div>
              
              {showDetails && log.details && (
                <div className="mt-1 p-1 bg-muted rounded overflow-x-auto">
                  <pre className="whitespace-pre-wrap text-2xs">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}</pre>
                </div>
              )}
              
              {showDetails && log.error && (
                <div className="mt-1 p-1 bg-red-100 dark:bg-red-900/20 rounded overflow-x-auto">
                  <pre className="whitespace-pre-wrap text-2xs text-red-800 dark:text-red-300">{typeof log.error === 'string' ? log.error : JSON.stringify(log.error, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default WebhookLogDisplay;
