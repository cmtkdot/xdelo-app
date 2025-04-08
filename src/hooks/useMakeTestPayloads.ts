
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeEventType, MakeTestPayload } from '@/types/make';
import { useToast } from '@/hooks/useToast';

/**
 * Hook to manage test payloads for Make webhooks
 */
export function useMakeTestPayloads() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all test payloads grouped by event type
  const useTestPayloads = (enabled = true) => 
    useQuery({
      queryKey: ['make-test-payloads'],
      queryFn: async (): Promise<Record<string, MakeTestPayload[]>> => {
        // Mock response for now - table doesn't exist yet
        console.log('Fetching test payloads (mock)');
        return {};
      },
      enabled,
    });

  // Fetch template payloads
  const useTemplatePayloads = (enabled = true) => 
    useQuery({
      queryKey: ['make-template-payloads'],
      queryFn: async (): Promise<Record<string, MakeTestPayload[]>> => {
        // Mock response for now - table doesn't exist yet
        console.log('Fetching template payloads (mock)');
        return {};
      },
      enabled,
    });

  // Fetch test payloads by event type
  const useTestPayloadsByEventType = (eventType: MakeEventType, enabled = true) =>
    useQuery({
      queryKey: ['make-test-payloads', eventType],
      queryFn: async (): Promise<MakeTestPayload[]> => {
        // Mock response for now - table doesn't exist yet
        console.log('Fetching test payloads by event type (mock):', eventType);
        return [];
      },
      enabled: !!eventType && enabled,
    });

  // Create a new test payload
  const createTestPayload = useMutation({
    mutationFn: async (payload: Omit<MakeTestPayload, 'id' | 'created_at' | 'updated_at'>) => {
      // Mock response for now - table doesn't exist yet
      console.log('Creating test payload (mock):', payload);
      return {
        ...payload,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as MakeTestPayload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-test-payloads'] });
      toast({
        title: 'Success',
        description: 'Test payload created',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create test payload: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update a test payload
  const updateTestPayload = useMutation({
    mutationFn: async (payload: Partial<MakeTestPayload> & { id: string }) => {
      // Mock response for now - table doesn't exist yet
      console.log('Updating test payload (mock):', payload);
      return {
        id: payload.id,
        name: payload.name || 'Test Payload',
        description: payload.description || null,
        event_type: payload.event_type || 'unknown',
        payload: payload.payload || {},
        is_template: payload.is_template ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as MakeTestPayload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-test-payloads'] });
      toast({
        title: 'Success',
        description: 'Test payload updated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update test payload: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete a test payload
  const deleteTestPayload = useMutation({
    mutationFn: async (id: string) => {
      // Mock response for now - table doesn't exist yet
      console.log('Deleting test payload (mock):', id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['make-test-payloads'] });
      toast({
        title: 'Success',
        description: 'Test payload deleted',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete test payload: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Generate default template payloads for each event type
  const generateDefaultTemplates = useMutation({
    mutationFn: async () => {
      // Mock response for now - table doesn't exist yet
      console.log('Generating default templates (mock)');
      
      const defaultTemplates = Object.values(MakeEventType).map(eventType => ({
        id: crypto.randomUUID(),
        name: `Default ${eventType} Template`, 
        description: `Default template for ${eventType} events`,
        event_type: eventType,
        payload: { sample: 'data' },
        is_template: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      return defaultTemplates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-test-payloads'] });
      toast({
        title: 'Success',
        description: 'Default templates generated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to generate templates: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    data: useTestPayloads().data,
    useTestPayloads,
    useTemplatePayloads,
    useTestPayloadsByEventType,
    createTestPayload,
    updateTestPayload,
    deleteTestPayload,
    generateDefaultTemplates
  };
}
