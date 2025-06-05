
import React from 'react';

export interface WebhookLogDisplayProps {
  logs: any[];
  showDetails?: boolean;
}

export function WebhookLogDisplay({ logs, showDetails = false }: WebhookLogDisplayProps) {
  if (!logs || logs.length === 0) {
    return <div className="text-muted-foreground text-sm">No logs available.</div>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log, index) => (
        <div key={index} className="border rounded p-2 text-xs">
          <div className="flex justify-between">
            <span className="font-medium">{log.event_type || 'Unknown Event'}</span>
            <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
          </div>
          
          {showDetails && log.metadata && (
            <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-auto max-h-24">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
