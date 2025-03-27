
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MakeWebhookLog } from '@/types/make';
import { formatDistanceToNow } from 'date-fns';

export interface WebhookLogDisplayProps {
  logs: MakeWebhookLog[];
  showDetails?: boolean;
}

const WebhookLogDisplay: React.FC<WebhookLogDisplayProps> = ({ logs, showDetails = false }) => {
  if (!logs || logs.length === 0) {
    return (
      <Card className="bg-muted/40">
        <CardContent className="p-4 text-center text-muted-foreground">
          No logs available
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="success">Success ({statusCode})</Badge>;
    } else if (statusCode >= 400 && statusCode < 500) {
      return <Badge variant="destructive">Client Error ({statusCode})</Badge>;
    } else if (statusCode >= 500) {
      return <Badge variant="destructive">Server Error ({statusCode})</Badge>;
    } else {
      return <Badge variant="outline">{statusCode}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <Card key={log.id} className="border-muted">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </span>
              {getStatusBadge(log.status_code)}
            </CardTitle>
          </CardHeader>
          {showDetails && (
            <CardContent className="p-4 pt-0">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="request-body">
                  <AccordionTrigger className="py-2 text-sm">Request Body</AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-[300px]">
                      {JSON.stringify(log.request_body, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="response-body">
                  <AccordionTrigger className="py-2 text-sm">Response Body</AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-[300px]">
                      {log.response_body
                        ? JSON.stringify(log.response_body, null, 2)
                        : 'No response body'}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
                {log.error_message && (
                  <AccordionItem value="error">
                    <AccordionTrigger className="py-2 text-sm">Error Message</AccordionTrigger>
                    <AccordionContent>
                      <div className="text-xs bg-destructive/10 text-destructive p-2 rounded-md">
                        {log.error_message}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

export default WebhookLogDisplay;
