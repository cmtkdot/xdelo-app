
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, FileJson, Clipboard, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export interface WebhookLogDisplayProps {
  logs: any[];
  showDetails?: boolean;
  maxItems?: number;
}

export function WebhookLogDisplay({ logs, showDetails = false, maxItems = 10 }: WebhookLogDisplayProps) {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const displayLogs = logs.slice(0, maxItems);

  const handleToggle = (id: string) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-500';
    if (status >= 300 && status < 400) return 'bg-blue-500';
    if (status >= 400 && status < 500) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (logs.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No webhook logs found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayLogs.map((log) => (
        <Card key={log.id} className="overflow-hidden">
          <Collapsible
            open={openItems[log.id] || showDetails}
            onOpenChange={() => handleToggle(log.id)}
          >
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                 onClick={() => handleToggle(log.id)}>
              <div className="flex items-center space-x-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-0 h-5 w-5">
                    {openItems[log.id] || showDetails ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <Badge className={`${getStatusColor(log.status_code)} text-white`}>
                  {log.status_code}
                </Badge>
                <span className="text-sm font-medium">{log.webhook_name || 'Webhook'}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                {log.created_at && formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </div>
            </div>

            <CollapsibleContent>
              <CardContent className="p-4 pt-0 space-y-4">
                {log.error_message && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-sm text-red-800 dark:text-red-200">
                    {log.error_message}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center">
                      <FileJson className="h-4 w-4 mr-1" />
                      Request Payload
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => copyToClipboard(JSON.stringify(log.request_body, null, 2), `req-${log.id}`)}
                    >
                      {copiedStates[`req-${log.id}`] ? 
                        <Check className="h-3 w-3 mr-1" /> : 
                        <Clipboard className="h-3 w-3 mr-1" />}
                      {copiedStates[`req-${log.id}`] ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">
                    {JSON.stringify(log.request_body, null, 2)}
                  </pre>
                </div>

                {log.response_body && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center">
                        <FileJson className="h-4 w-4 mr-1" />
                        Response Data
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => copyToClipboard(JSON.stringify(log.response_body, null, 2), `res-${log.id}`)}
                      >
                        {copiedStates[`res-${log.id}`] ? 
                          <Check className="h-3 w-3 mr-1" /> : 
                          <Clipboard className="h-3 w-3 mr-1" />}
                        {copiedStates[`res-${log.id}`] ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">
                      {JSON.stringify(log.response_body, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      {logs.length > maxItems && (
        <div className="text-center text-sm text-muted-foreground pt-2">
          Showing {maxItems} of {logs.length} logs
        </div>
      )}
    </div>
  );
}
