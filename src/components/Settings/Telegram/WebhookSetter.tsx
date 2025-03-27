import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod"

const formSchema = z.object({
  webhookUrl: z.string().url({ message: "Please enter a valid URL." }),
  active: z.boolean().default(false),
})

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date: number | null;
  last_error_message: string | null;
  max_connections: number;
  ip_address: string | null;
}

async function getWebhookInfo(): Promise<WebhookInfo | null> {
  try {
    const response = await fetch('/api/get-telegram-webhook-info');
    if (!response.ok) {
      console.error('Failed to get webhook info:', response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error('Error getting webhook info:', error);
    return null;
  }
}

async function setWebhook(url: string): Promise<boolean> {
  try {
    const response = await fetch('/api/set-telegram-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      console.error('Failed to set webhook:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    if (!data.ok) {
      console.error('Failed to set webhook:', data.description);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error setting webhook:', error);
    return false;
  }
}

async function deleteWebhook(): Promise<boolean> {
  try {
    const response = await fetch('/api/delete-telegram-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to delete webhook:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return false;
  }
}

const WebhookSetter = () => {
  const [isSetting, setIsSetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      webhookUrl: "",
      active: false,
    },
  })

  useEffect(() => {
    const fetchWebhookStatus = async () => {
      const info = await getWebhookInfo();
      setWebhookInfo(info);
      form.setValue("active", !!info?.url)
      form.setValue("webhookUrl", info?.url || "")
    };

    fetchWebhookStatus();
  }, [form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.active) {
      setIsSetting(true);
      const success = await setWebhook(values.webhookUrl);
      setIsSetting(false);

      if (success) {
        toast({
          title: 'Webhook Set',
          description: 'Webhook URL has been successfully set.',
        });
        const info = await getWebhookInfo();
        setWebhookInfo(info);
      } else {
        toast({
          title: 'Failed to Set Webhook',
          description: 'Failed to set the webhook URL. Check the console for errors.',
          variant: 'destructive',
        });
      }
    } else {
      setIsDeleting(true);
      const success = await deleteWebhook();
      setIsDeleting(false);

      if (success) {
        toast({
          title: 'Webhook Deleted',
          description: 'Webhook has been successfully deleted.',
        });
        const info = await getWebhookInfo();
        setWebhookInfo(info);
      } else {
        toast({
          title: 'Failed to Delete Webhook',
          description: 'Failed to delete the webhook. Check the console for errors.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="webhookUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webhook URL</FormLabel>
              <FormControl>
                <Input placeholder="https://your-app.com/api/telegram-webhook" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Webhook Active</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSetting || isDeleting}>
          {isSetting
            ? 'Setting Webhook...'
            : isDeleting
              ? 'Deleting Webhook...'
              : 'Save Changes'}
        </Button>

        {webhookInfo && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Webhook Info:</h3>
            <pre>{JSON.stringify(webhookInfo, null, 2)}</pre>
          </div>
        )}
      </form>
    </Form>
  );
}
export default WebhookSetter;
