
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TelegramCardProps {
  botToken: string | null;
  webhookUrl: string | null;
}

export function TelegramCard({ botToken, webhookUrl }: TelegramCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Mask the bot token to only show the first few and last few characters
  const maskToken = (token: string | null) => {
    if (!token) return "Not configured";
    if (token.length <= 10) return token;
    return token.substring(0, 6) + "..." + token.substring(token.length - 4);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Telegram Bot Configuration</CardTitle>
        <CardDescription>
          View your Telegram bot's configuration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="botToken">Bot Token</Label>
          <Input
            id="botToken"
            value={maskToken(botToken)}
            readOnly
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <Input
            id="webhookUrl"
            value={webhookUrl || "Not configured"}
            readOnly
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The webhook URL is where Telegram sends updates to your bot.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
