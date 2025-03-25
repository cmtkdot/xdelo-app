
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { WebhookLogDisplay } from "@/components/ui/webhook-log-display";

interface WebhookSetterProps {
  onSetWebhook: () => Promise<void>;
  isSettingWebhook: boolean;
  webhookStatus: 'idle' | 'success' | 'error';
  webhookLog: any | null;
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
    <div className="space-y-2 pt-2">
      <Button 
        onClick={onSetWebhook}
        disabled={isSettingWebhook || disabled}
        className="w-full"
      >
        {isSettingWebhook ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Setting Webhook...
          </>
        ) : (
          "Set Telegram Webhook"
        )}
      </Button>
      
      {webhookStatus === 'success' && (
        <div className="flex items-center text-green-500 mt-2">
          <Check className="h-4 w-4 mr-2" />
          <span className="text-sm">Webhook set successfully</span>
        </div>
      )}
      
      {webhookStatus === 'error' && (
        <div className="flex items-center text-red-500 mt-2">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span className="text-sm">Failed to set webhook</span>
        </div>
      )}
      
      {webhookLog && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Webhook Setup Log</h4>
          <WebhookLogDisplay log={webhookLog} showDetails={true} />
        </div>
      )}
    </div>
  );
}
