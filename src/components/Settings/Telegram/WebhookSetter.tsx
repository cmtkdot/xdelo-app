
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

interface WebhookSetterProps {
  onSetWebhook: () => void;
  isSettingWebhook: boolean;
  webhookStatus: 'idle' | 'success' | 'error';
  webhookLog: any;
  disabled?: boolean;
}

export function WebhookSetter({
  onSetWebhook,
  isSettingWebhook,
  webhookStatus,
  webhookLog,
  disabled = false
}: WebhookSetterProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
        <Button
          onClick={onSetWebhook}
          disabled={disabled || isSettingWebhook}
          className="flex items-center"
        >
          {isSettingWebhook && <Spinner className="mr-2 h-4 w-4" />}
          Set Webhook
        </Button>
      </div>

      {webhookStatus !== 'idle' && (
        <div className={`p-4 rounded-md ${
          webhookStatus === 'success' 
            ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
            : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
        }`}>
          <div className="flex items-start">
            {webhookStatus === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            )}
            <div>
              <h3 className="text-sm font-medium">
                {webhookStatus === 'success' ? 'Webhook Set Successfully' : 'Webhook Setting Failed'}
              </h3>
              {webhookLog && (
                <div className="mt-2 text-sm">
                  <WebhookLogDisplay logs={webhookLog?.logs || []} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface WebhookLogDisplayProps {
  logs: any[];
}

export function WebhookLogDisplay({ logs }: WebhookLogDisplayProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="flex items-center text-muted-foreground">
        <Info className="h-4 w-4 mr-1" />
        <span>No logs available</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log, index) => (
        <div key={index} className="text-xs">
          <Badge variant={log.success ? "success" : "destructive"} className="mb-1">
            {log.type || "Log"}
          </Badge>
          <pre className="whitespace-pre-wrap bg-black/5 p-2 rounded text-xs">
            {typeof log.message === 'string' 
              ? log.message 
              : JSON.stringify(log.message || log, null, 2)
            }
          </pre>
        </div>
      ))}
    </div>
  );
}
