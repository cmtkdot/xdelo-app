import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeWebhookConfig, MakeEventType } from '@/types/make';
import { useToast } from '@/hooks/useToast';

/**
 * Hook to manage Make webhooks
 */
export function useMakeWebhooks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        return data;
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
        return data;
      },
      enabled,
    });

  // Create a new webhook
  const createWebhook = useMutation({
    mutationFn: async (webhook: Omit<MakeWebhookConfig, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('make_webhook_configs')
        .insert(webhook)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
        .update(webhook)
        .eq('id', webhook.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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