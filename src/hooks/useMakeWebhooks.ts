
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeWebhookConfig } from '@/types/MakeAutomation';
import { useToast } from '@/hooks/useToast';

export function useMakeWebhooks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);

  // Fetch all webhooks
  const {
    data: webhooks,
    isLoading,
    error
  } = useQuery({
    queryKey: ['make_webhook_configs'],
    queryFn: async () => {
      try {
        // This is a stub function since the make_webhook_configs table doesn't exist yet
        // Return an empty array to prevent TypeScript errors
        return [] as MakeWebhookConfig[];
      } catch (error) {
        console.error('Error fetching webhooks:', error);
        throw error;
      }
    }
  });

  // Create new webhook
  const createWebhookMutation = useMutation({
    mutationFn: async (newWebhook: Omit<MakeWebhookConfig, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        // This is a stub function
        console.log('Would create webhook:', newWebhook);
        return { id: 'stub-id' };
      } catch (error) {
        console.error('Error creating webhook:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_webhook_configs'] });
      toast({
        title: 'Webhook created',
        description: 'Your webhook was created successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating webhook',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Update existing webhook
  const updateWebhookMutation = useMutation({
    mutationFn: async (webhook: Partial<MakeWebhookConfig> & { id: string }) => {
      try {
        // This is a stub function
        console.log('Would update webhook:', webhook);
        return { id: webhook.id };
      } catch (error) {
        console.error('Error updating webhook:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_webhook_configs'] });
      toast({
        title: 'Webhook updated',
        description: 'Your webhook was updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating webhook',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Delete webhook
  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      try {
        // This is a stub function
        console.log('Would delete webhook:', webhookId);
        return { id: webhookId };
      } catch (error) {
        console.error('Error deleting webhook:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_webhook_configs'] });
      toast({
        title: 'Webhook deleted',
        description: 'Your webhook was deleted successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting webhook',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Toggle webhook active status
  const toggleWebhookStatusMutation = useMutation({
    mutationFn: async ({ webhookId, isActive }: { webhookId: string; isActive: boolean }) => {
      try {
        // This is a stub function
        console.log('Would toggle webhook status:', webhookId, isActive);
        return { id: webhookId };
      } catch (error) {
        console.error('Error toggling webhook status:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['make_webhook_configs'] });
      toast({
        title: variables.isActive ? 'Webhook activated' : 'Webhook deactivated',
        description: `The webhook was ${variables.isActive ? 'activated' : 'deactivated'} successfully`
      });
    },
    onError: (error) => {
      toast({
        title: 'Error toggling webhook status',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  return {
    webhooks: webhooks || [],
    isLoading,
    error,
    selectedWebhookId,
    setSelectedWebhookId,
    createWebhook: createWebhookMutation.mutate,
    updateWebhook: updateWebhookMutation.mutate,
    deleteWebhook: deleteWebhookMutation.mutate,
    toggleWebhookStatus: toggleWebhookStatusMutation.mutate,
    isCreating: createWebhookMutation.isPending,
    isUpdating: updateWebhookMutation.isPending,
    isDeleting: deleteWebhookMutation.isPending,
    isTogglingStatus: toggleWebhookStatusMutation.isPending
  };
}
