
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  disabled 
}: WebhookSetterProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Set Telegram Webhook</span>
        <Button 
          onClick={onSetWebhook} 
          disabled={isSettingWebhook || disabled}
          size="sm"
          variant="default"
        >
          {isSettingWebhook ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Setting Webhook...
            </>
          ) : (
            'Set Webhook'
          )}
        </Button>
      </div>

      {webhookStatus !== 'idle' && (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
          <Card className={webhookStatus === 'success' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20'}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {webhookStatus === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {webhookStatus === 'success' ? 'Webhook set successfully' : 'Failed to set webhook'}
                  </span>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    {open ? 'Hide Details' : 'Show Details'}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-2">
                <pre className="bg-card border p-2 rounded text-xs overflow-auto max-h-48">
                  {JSON.stringify(webhookLog, null, 2)}
                </pre>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}

export default WebhookSetter;
