
import { CheckCircle, XCircle, AlertCircle, Clock, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MakeWebhookLog } from "@/types/make";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface WebhookLogDisplayProps {
  log: MakeWebhookLog;
  showDetails?: boolean;
  onRetry?: (logId: string) => void;
}

export function WebhookLogDisplay({ log, showDetails = false, onRetry }: WebhookLogDisplayProps) {
  const [isOpen, setIsOpen] = useState(showDetails);
  
  // Format the timestamp for display
  const formattedTime = log.created_at 
    ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
    : 'Unknown time';
  
  // Determine status icon
  const StatusIcon = () => {
    switch (log.status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };
  
  // Create summary text
  const getSummaryText = () => {
    const eventName = log.event_type.replace(/_/g, ' ');
    
    if (log.status === 'success') {
      return `✅ Successfully sent "${eventName}" webhook`;
    } else if (log.status === 'failed') {
      return `❌ Failed to send "${eventName}" webhook`;
    } else {
      return `⏳ Pending "${eventName}" webhook`;
    }
  };
  
  // Format the correlation ID for display
  const correlationId = log.context?.correlationId 
    ? `${log.context.correlationId}`
    : 'Not available';
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon />
            <CardTitle className="text-md">{getSummaryText()}</CardTitle>
          </div>
          <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'outline'}>
            {log.status}
          </Badge>
        </div>
        <CardDescription>
          {log.event_type} • {formattedTime} • {log.duration_ms ? `${log.duration_ms}ms` : 'No duration'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="mb-2">
          <strong>Correlation ID:</strong> {correlationId}
        </div>
        
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {isOpen ? "Hide Details" : "Show Details"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {log.error_message && (
              <div className="rounded-md bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
                <h4 className="font-bold">Error</h4>
                <p>{log.error_message}</p>
              </div>
            )}
            
            {log.response_code && (
              <div className="text-sm">
                <strong>Response Code:</strong> {log.response_code}
              </div>
            )}
            
            {log.webhook_id && (
              <div className="text-sm">
                <strong>Webhook ID:</strong> {log.webhook_id}
              </div>
            )}
            
            {log.next_retry_at && (
              <div className="text-sm">
                <strong>Next Retry:</strong> {formatDistanceToNow(new Date(log.next_retry_at), { addSuffix: true })}
              </div>
            )}
            
            {log.retry_count && log.retry_count > 0 && (
              <div className="text-sm">
                <strong>Retry Count:</strong> {log.retry_count}
              </div>
            )}
            
            {log.payload && (
              <div className="mt-2">
                <h4 className="text-sm font-bold">Payload</h4>
                <pre className="mt-1 max-h-[200px] overflow-auto rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            )}
            
            {log.status === 'failed' && onRetry && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => onRetry(log.id)}
                className="mt-2"
              >
                Retry Webhook
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
