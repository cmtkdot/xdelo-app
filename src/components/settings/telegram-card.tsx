
import { Card } from "@/components/ui/card";

interface TelegramCardProps {
  botToken: string | null;
  webhookUrl: string | null;
  onUpdate: () => Promise<void>;
}

export function TelegramCard({ botToken, webhookUrl, onUpdate }: TelegramCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-medium">Telegram Integration</h3>
      <div className="mt-4 space-y-2">
        <p className="text-sm text-gray-600">Bot Token: {botToken ? "••••••••" : "Not set"}</p>
        <p className="text-sm text-gray-600">Webhook URL: {webhookUrl || "Not set"}</p>
      </div>
    </Card>
  );
}
