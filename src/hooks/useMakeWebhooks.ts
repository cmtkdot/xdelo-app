
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeWebhookConfig, MakeEventType } from '@/types/make';
import { useToast } from '@/hooks/useToast';

/**
 * Hook to manage Make webhooks
 * Note: This is a placeholder implementation - the actual tables need to be created 
 */
export function useMakeWebhooks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mock data until database tables are created
  const mockWebhooks: MakeWebhookConfig[] = [
    {
      id: "1",
      name: "New Message Webhook",
      description: "Sends new messages to Make.com",
      url: "https://hook.us1.make.com/abc123",
      event_type: "message_received",
      is_active: true,
      headers: null,
      retry_config: null,
      field_selection: null,
      payload_template: null,
      transformation_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // Fetch all webhooks
  const useWebhooks = (enabled = true) => 
    useQuery({
      queryKey: ['make-webhooks'],
      queryFn: async (): Promise<MakeWebhookConfig[]> => {
        // Mock implementation
        return mockWebhooks;
      },
      enabled,
    });

  // Fetch active webhooks
  const useActiveWebhooks = (enabled = true) =>
    useQuery({
      queryKey: ['make-webhooks', 'active'],
      queryFn: async (): Promise<MakeWebhookConfig[]> => {
        // Mock implementation
        return mockWebhooks.filter(webhook => webhook.is_active);
      },
      enabled,
    });

  // Create a new webhook
  const createWebhook = useMutation({
    mutationFn: async (webhook: Omit<MakeWebhookConfig, 'id' | 'created_at' | 'updated_at'>) => {
      // Mock implementation
      const newId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const newWebhook = {
        ...webhook,
        id: newId,
        created_at: timestamp,
        updated_at: timestamp
      };
      
      mockWebhooks.push(newWebhook);
      return newWebhook;
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
      // Mock implementation
      const index = mockWebhooks.findIndex(w => w.id === webhook.id);
      
      if (index === -1) {
        throw new Error('Webhook not found');
      }
      
      mockWebhooks[index] = {
        ...mockWebhooks[index],
        ...webhook,
        updated_at: new Date().toISOString()
      };
      
      return mockWebhooks[index];
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
      // Mock implementation
      const index = mockWebhooks.findIndex(w => w.id === id);
      
      if (index === -1) {
        throw new Error('Webhook not found');
      }
      
      mockWebhooks[index] = {
        ...mockWebhooks[index],
        is_active: isActive,
        updated_at: new Date().toISOString()
      };
      
      return mockWebhooks[index];
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
      // Mock implementation
      const index = mockWebhooks.findIndex(w => w.id === id);
      
      if (index === -1) {
        throw new Error('Webhook not found');
      }
      
      mockWebhooks.splice(index, 1);
      return id;
    },
    onSuccess: () => {
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
      // Mock implementation - would ideally call an edge function
      console.log(`Testing webhook ${id} with payload:`, payload);
      
      // Simulated response
      return {
        success: true,
        webhook_id: id,
        timestamp: new Date().toISOString(),
        status: 200,
        response: { message: "Test successful" }
      };
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
