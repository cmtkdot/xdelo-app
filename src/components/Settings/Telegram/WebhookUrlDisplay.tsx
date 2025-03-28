
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface WebhookUrlDisplayProps {
  webhookUrl: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  isDisabled: boolean;
}

export function WebhookUrlDisplay({
  webhookUrl,
  onRefresh,
  isRefreshing,
  isDisabled
}: WebhookUrlDisplayProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor="webhookUrl">Webhook URL</Label>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRefresh} 
          disabled={isRefreshing || isDisabled}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="ml-1 sr-only">Refresh</span>
        </Button>
      </div>
      <Input
        id="webhookUrl"
        value={webhookUrl || "Not configured"}
        readOnly
        disabled={isDisabled}
      />
      <p className="text-xs text-muted-foreground mt-1">
        The webhook URL is where Telegram sends updates to your bot.
      </p>
    </div>
  );
}
