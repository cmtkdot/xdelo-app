
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

  // Helper function to transform database records to the expected type
  const transformWebhookData = (data: any[]): MakeWebhookConfig[] => {
    return data.map(webhook => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      event_types: webhook.event_types || [],
      is_active: webhook.is_active ?? false,
      field_selection: webhook.field_selection || null,
      payload_template: webhook.payload_template || null,
      transformation_code: webhook.transformation_code || null,
      headers: webhook.headers || null,
      retry_config: webhook.retry_config || null,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at
    }));
  };

  // Fetch all webhooks
  const useWebhooks = (enabled = true) => 
    useQuery({
      queryKey: ['make-webhooks'],
      queryFn: async (): Promise<MakeWebhookConfig[]> => {
        // Mock response for now - table doesn't exist yet
        console.log('Fetching webhooks (mock)');
        return [];
      },
      enabled,
    });

  // Fetch active webhooks
  const useActiveWebhooks = (enabled = true) =>
    useQuery({
      queryKey: ['make-webhooks', 'active'],
      queryFn: async (): Promise<MakeWebhookConfig[]> => {
        // Mock response for now - table doesn't exist yet
        console.log('Fetching active webhooks (mock)');
        return [];
      },
      enabled,
    });

  // Create a new webhook
  const createWebhook = useMutation({
    mutationFn: async (webhook: Omit<MakeWebhookConfig, 'id' | 'created_at' | 'updated_at'>) => {
      // Mock response for now - table doesn't exist yet
      console.log('Creating webhook (mock):', webhook);
      return {
        ...webhook,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as MakeWebhookConfig;
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
      // Mock response for now - table doesn't exist yet
      console.log('Updating webhook (mock):', webhook);
      return {
        id: webhook.id,
        name: webhook.name || 'Unknown',
        url: webhook.url || 'https://example.com',
        event_types: webhook.event_types || [],
        is_active: webhook.is_active ?? true,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      } as MakeWebhookConfig;
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
      // Mock response for now - table doesn't exist yet
      console.log('Toggling webhook (mock):', { id, isActive });
      return {
        id,
        name: 'Mock Webhook',
        url: 'https://example.com',
        event_types: [],
        is_active: isActive,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      } as MakeWebhookConfig;
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
      // Mock response for now - table doesn't exist yet
      console.log('Deleting webhook (mock):', id);
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
      // Mock response for now - edge function doesn't exist yet
      console.log('Testing webhook (mock):', { id, payload });
      return { success: true };
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
