
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeWebhookConfig, MakeEventType } from '@/types/make';
import { useToast } from '@/hooks/useToast';
import { Database } from '@/integrations/supabase/database.types';

type MakeWebhookConfigRow = Database['public']['Tables']['make_webhook_configs']['Row'];

/**
 * Hook to manage Make webhooks
 */
export function useMakeWebhooks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper function to transform database records to the expected type
  const transformWebhookData = (data: MakeWebhookConfigRow[]): MakeWebhookConfig[] => {
    return data.map(webhook => ({
      ...webhook,
      field_selection: webhook.field_selection || null,
      payload_template: webhook.payload_template || null,
      transformation_code: webhook.transformation_code || null,
      headers: webhook.headers || null,
      retry_config: webhook.retry_config || null
    }));
  };

  // Fetch all webhooks
  const useWebhooks = (enabled = true) => 
    useQuery({
      queryKey: ['make-webhooks'],
      queryFn: async (): Promise<MakeWebhookConfig[]> => {
        const { data, error } = await supabase
          .from('make_webhook_configs')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return transformWebhookData(data as MakeWebhookConfigRow[]);
      },
      enabled,
    });

  // Fetch active webhooks
  const useActiveWebhooks = (enabled = true) =>
    useQuery({
      queryKey: ['make-webhooks', 'active'],
      queryFn: async (): Promise<MakeWebhookConfig[]> => {
        const { data, error } = await supabase
          .from('make_webhook_configs')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return transformWebhookData(data as MakeWebhookConfigRow[]);
      },
      enabled,
    });

  // Create a new webhook
  const createWebhook = useMutation({
    mutationFn: async (webhook: Omit<MakeWebhookConfig, 'id' | 'created_at' | 'updated_at'>) => {
      // Ensure webhook has all required fields
      if (!webhook.name || !webhook.url || !webhook.event_types) {
        throw new Error('Missing required fields: name, url, or event_types');
      }

      const { data, error } = await supabase
        .from('make_webhook_configs')
        .insert({
          name: webhook.name,
          description: webhook.description,
          url: webhook.url,
          event_types: webhook.event_types,
          is_active: webhook.is_active !== undefined ? webhook.is_active : true,
          field_selection: webhook.field_selection || null,
          payload_template: webhook.payload_template || null,
          transformation_code: webhook.transformation_code || null,
          headers: webhook.headers || null,
          retry_config: webhook.retry_config || null
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return transformWebhookData([data as MakeWebhookConfigRow])[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-webhooks'] });
      toast({
        title: 'Success',
        description: 'Webhook created',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create webhook: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update a webhook
  const updateWebhook = useMutation({
    mutationFn: async (webhook: Partial<MakeWebhookConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('make_webhook_configs')
        .update(webhook as any)
        .eq('id', webhook.id)
        .select()
        .single();
      
      if (error) throw error;
      return transformWebhookData([data as MakeWebhookConfigRow])[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-webhooks'] });
      toast({
        title: 'Success',
        description: 'Webhook updated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update webhook: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Toggle a webhook's active state
  const toggleWebhook = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('make_webhook_configs')
        .update({ is_active: isActive } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return transformWebhookData([data as MakeWebhookConfigRow])[0];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['make-webhooks'] });
      toast({
        title: 'Success',
        description: `Webhook ${data.is_active ? 'activated' : 'deactivated'}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to toggle webhook: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete a webhook
  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('make_webhook_configs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['make-webhooks'] });
      toast({
        title: 'Success',
        description: 'Webhook deleted',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete webhook: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Test a webhook
  const testWebhook = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload?: Record<string, any> }) => {
      // Implement via edge function call
      const { data, error } = await supabase.functions.invoke('make-webhook-tester', {
        body: {
          webhookId: id,
          testPayload: payload || { test: true, timestamp: new Date().toISOString() }
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Webhook test sent',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to test webhook: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    useWebhooks,
    useActiveWebhooks,
    createWebhook,
    updateWebhook,
    toggleWebhook,
    deleteWebhook,
    testWebhook
  };
}
