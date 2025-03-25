
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  max_connections: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  is_active?: boolean;
}

interface WebhookStatusProps {
  webhookInfo: WebhookInfo | null;
  verificationUrls: {
    set_webhook?: string;
    get_webhook_info?: string;
  };
}

export function WebhookStatus({ webhookInfo, verificationUrls }: WebhookStatusProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (!webhookInfo) {
    return null;
  }

  return (
    <div className="space-y-2 mt-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Webhook Status:</h3>
        {webhookInfo.url ? (
          <Badge variant={webhookInfo.last_error_message ? "outline" : "default"}>
            {webhookInfo.last_error_message ? "Issues detected" : "Active"}
          </Badge>
        ) : (
          <Badge variant="destructive">Not configured</Badge>
        )}
      </div>
          
      <Collapsible
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        className="mt-2 space-y-2"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">
            Webhook Details
          </h4>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <ChevronDown className={`h-4 w-4 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`} />
              <span className="sr-only">Toggle details</span>
            </Button>
          </CollapsibleTrigger>
        </div>
          
        <CollapsibleContent className="space-y-2">
          <div className="rounded-md border p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending updates:</span>
              <span>{webhookInfo.pending_update_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max connections:</span>
              <span>{webhookInfo.max_connections}</span>
            </div>
            {webhookInfo.ip_address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Server IP:</span>
                <span>{webhookInfo.ip_address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custom certificate:</span>
              <span>{webhookInfo.has_custom_certificate ? "Yes" : "No"}</span>
            </div>
            {webhookInfo.last_error_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last error:</span>
                <span>{formatDate(webhookInfo.last_error_date)}</span>
              </div>
            )}
            {webhookInfo.last_error_message && (
              <div className="pt-1">
                <span className="text-muted-foreground">Error message:</span>
                <p className="mt-1 text-xs p-2 bg-muted rounded">{webhookInfo.last_error_message}</p>
              </div>
            )}
              
            {verificationUrls.set_webhook && (
              <>
                <Separator className="my-2" />
                <div className="pt-1">
                  <span className="text-muted-foreground">Verification Links:</span>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs justify-start"
                      onClick={() => window.open(verificationUrls.get_webhook_info, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Get Webhook Info
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
