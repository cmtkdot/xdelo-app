
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TestPayload } from '@/types/MakeAutomation';
import { useToast } from '@/hooks/useToast';
import { Json } from '@/integrations/supabase/types';

export function useMakeTestPayloads() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPayloadId, setSelectedPayloadId] = useState<string | null>(null);

  // Fetch all test payloads
  const {
    data: payloads,
    isLoading,
    error
  } = useQuery({
    queryKey: ['make_test_payloads'],
    queryFn: async () => {
      try {
        // This is a stub function since the make_test_payloads table doesn't exist yet
        // We'll return an empty record for now to prevent TypeScript errors
        return {} as Record<string, TestPayload[]>;
      } catch (error) {
        console.error('Error fetching test payloads:', error);
        throw error;
      }
    }
  });

  // Create new test payload
  const createPayloadMutation = useMutation({
    mutationFn: async (newPayload: Omit<TestPayload, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        // This is a stub function
        console.log('Would create test payload:', newPayload);
        return { id: 'stub-id' };
      } catch (error) {
        console.error('Error creating test payload:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_test_payloads'] });
      toast({
        title: 'Test payload created',
        description: 'Your test payload was created successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating test payload',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Update existing test payload
  const updatePayloadMutation = useMutation({
    mutationFn: async (payload: Partial<TestPayload> & { id: string }) => {
      try {
        // This is a stub function
        console.log('Would update test payload:', payload);
        return { id: payload.id };
      } catch (error) {
        console.error('Error updating test payload:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_test_payloads'] });
      toast({
        title: 'Test payload updated',
        description: 'Your test payload was updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating test payload',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Delete test payload
  const deletePayloadMutation = useMutation({
    mutationFn: async (payloadId: string) => {
      try {
        // This is a stub function
        console.log('Would delete test payload:', payloadId);
        return { id: payloadId };
      } catch (error) {
        console.error('Error deleting test payload:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_test_payloads'] });
      toast({
        title: 'Test payload deleted',
        description: 'Your test payload was deleted successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting test payload',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Convert payload to template
  const convertToTemplateMutation = useMutation({
    mutationFn: async (payload: TestPayload) => {
      try {
        // This is a stub function
        console.log('Would convert payload to template:', payload);
        return { id: payload.id };
      } catch (error) {
        console.error('Error converting payload to template:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_test_payloads'] });
      toast({
        title: 'Converted to template',
        description: 'The payload was converted to a template successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error converting to template',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Use template to create new payload
  const useTemplateMutation = useMutation({
    mutationFn: async ({ templateId, customValues }: { templateId: string; customValues?: Json }) => {
      try {
        // This is a stub function
        console.log('Would use template for new payload:', templateId, customValues);
        return { id: 'new-payload-id' };
      } catch (error) {
        console.error('Error using template:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_test_payloads'] });
      toast({
        title: 'New payload created',
        description: 'A new payload was created from the template'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating from template',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  return {
    payloads: payloads || {},
    isLoading,
    error,
    selectedPayloadId,
    setSelectedPayloadId,
    createPayload: createPayloadMutation.mutate,
    updatePayload: updatePayloadMutation.mutate,
    deletePayload: deletePayloadMutation.mutate,
    convertToTemplate: convertToTemplateMutation.mutate,
    useTemplate: useTemplateMutation.mutate,
    isCreating: createPayloadMutation.isPending,
    isUpdating: updatePayloadMutation.isPending,
    isDeleting: deletePayloadMutation.isPending,
    isConverting: convertToTemplateMutation.isPending,
    isCreatingFromTemplate: useTemplateMutation.isPending
  };
}
