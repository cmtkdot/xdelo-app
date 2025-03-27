
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface WebhookLogDisplayProps {
  logs: any[];
  showDetails?: boolean; // Made optional
}

export function WebhookLogDisplay({ logs, showDetails = false }: WebhookLogDisplayProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No webhook logs available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showDetails ? (
        <Accordion type="single" collapsible>
          {logs.map((log, index) => (
            <AccordionItem key={index} value={`log-${index}`}>
              <AccordionTrigger className="text-sm">
                {log.event || 'Webhook Event'} - {new Date(log.timestamp).toLocaleString()}
              </AccordionTrigger>
              <AccordionContent>
                <pre className="bg-muted p-2 rounded-md text-xs overflow-auto max-h-64">
                  {JSON.stringify(log, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <ul className="space-y-2">
          {logs.slice(0, 5).map((log, index) => (
            <li key={index} className="text-sm border-b pb-2">
              {log.event || 'Webhook Event'} - {new Date(log.timestamp).toLocaleString()}
            </li>
          ))}
          {logs.length > 5 && (
            <li className="text-sm text-muted-foreground">
              + {logs.length - 5} more events...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
