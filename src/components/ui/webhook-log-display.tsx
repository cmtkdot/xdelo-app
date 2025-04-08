
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  ArrowRightCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Updated interface to match the actual structure used
interface MakeWebhookLog {
  id: string;
  webhook_id: string;
  webhook_name?: string;
  webhook_url?: string;
  event_type: string;
  status: 'success' | 'error' | 'pending' | 'retry';
  request_payload?: Record<string, any>;
  response_payload?: Record<string, any>;
  response_status?: number;
  error_message?: string;
  retry_count?: number;
  retry_scheduled?: string;
  created_at: string;
  updated_at?: string;
  metadata?: {
    duration_ms?: number;
    response_code?: number;
    context?: any;
    next_retry_at?: string;
    [key: string]: any;
  };
}

interface WebhookLogDisplayProps {
  log: MakeWebhookLog;
  showDetails?: boolean;
}

export function WebhookLogDisplay({
  log,
  showDetails = false
}: WebhookLogDisplayProps) {
  // Format date to readable string
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "bg-green-100 text-green-800";
      case "error": return "bg-red-100 text-red-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "retry": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Get context data (if available)
  const contextData = log.metadata?.context ? (
    <div className="text-xs text-muted-foreground mt-1">
      Context: {JSON.stringify(log.metadata.context)}
    </div>
  ) : null;

  // Show duration if available
  const duration = log.metadata?.duration_ms ? (
    <div className="text-xs text-muted-foreground">
      Duration: {log.metadata.duration_ms}ms
    </div>
  ) : null;

  // Status icon
  const StatusIcon = () => {
    switch (log.status) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "pending": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "retry": return <ArrowRightCircle className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  // Response code display if available
  const responseCodeDisplay = log.metadata?.response_code ? (
    <div className="mt-2 flex items-center gap-1">
      <span className="font-medium">Response:</span>
      <Badge variant={log.metadata.response_code >= 400 ? "destructive" : "outline"}>
        {log.metadata.response_code}
      </Badge>
    </div>
  ) : null;

  // Retry information if available
  const retryInfo = log.metadata?.next_retry_at ? (
    <div className="mt-2 flex items-center gap-1">
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        Next retry: {new Date(log.metadata.next_retry_at).toLocaleString()}
      </span>
    </div>
  ) : null;

  return (
    <Card className="mb-2">
      <CardContent className="pt-4 pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <StatusIcon />
            <div>
              <span className="font-medium">{log.webhook_name || log.webhook_id}</span>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(log.created_at)}
              </div>
            </div>
          </div>
          <Badge className={getStatusColor(log.status)}>
            {log.status}
          </Badge>
        </div>
        
        {contextData}
        {duration}
        {responseCodeDisplay}
        {retryInfo}

        {showDetails && log.error_message && (
          <div className="mt-2">
            <Badge variant="destructive" className="mt-1">Error</Badge>
            <div className="text-xs text-red-500 mt-1 p-2 bg-red-50 rounded">
              {log.error_message}
            </div>
          </div>
        )}

        {showDetails && (
          <Accordion type="single" collapsible className="mt-2">
            <AccordionItem value="details">
              <AccordionTrigger className="text-xs py-1">Show Technical Details</AccordionTrigger>
              <AccordionContent>
                <div className="text-xs space-y-2">
                  <div>
                    <div className="font-semibold">Request Payload</div>
                    <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.request_payload || {}, null, 2)}
                    </pre>
                  </div>
                  
                  {log.response_payload && (
                    <div>
                      <div className="font-semibold">Response Payload</div>
                      <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.response_payload, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  <div>
                    <div className="font-semibold">Metadata</div>
                    <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.metadata || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
