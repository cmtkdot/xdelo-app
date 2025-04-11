
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeAutomationRule } from '@/types/MakeAutomation';
import { useToast } from '@/hooks/useToast';

export function useMakeAutomations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Fetch all automation rules
  const {
    data: rules,
    isLoading,
    error
  } = useQuery({
    queryKey: ['make_automation_rules'],
    queryFn: async () => {
      try {
        // This is a stub function since the make_automation_rules table doesn't exist yet
        // We'll return an empty array for now to prevent TypeScript errors
        return [] as MakeAutomationRule[];
      } catch (error) {
        console.error('Error fetching automation rules:', error);
        throw error;
      }
    }
  });

  // Create new rule
  const createRuleMutation = useMutation({
    mutationFn: async (newRule: Omit<MakeAutomationRule, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        // This is a stub function since the make_automation_rules table doesn't exist yet
        console.log('Would create rule:', newRule);
        return { id: 'stub-id' };
      } catch (error) {
        console.error('Error creating automation rule:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_automation_rules'] });
      toast({
        title: 'Rule created',
        description: 'Your automation rule was created successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating rule',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Update existing rule
  const updateRuleMutation = useMutation({
    mutationFn: async (rule: Partial<MakeAutomationRule> & { id: string }) => {
      try {
        // This is a stub function since the make_automation_rules table doesn't exist yet
        console.log('Would update rule:', rule);
        return { id: rule.id };
      } catch (error) {
        console.error('Error updating automation rule:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_automation_rules'] });
      toast({
        title: 'Rule updated',
        description: 'Your automation rule was updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating rule',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Delete rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      try {
        // This is a stub function since the make_automation_rules table doesn't exist yet
        console.log('Would delete rule:', ruleId);
        return { id: ruleId };
      } catch (error) {
        console.error('Error deleting automation rule:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_automation_rules'] });
      toast({
        title: 'Rule deleted',
        description: 'Your automation rule was deleted successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting rule',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  // Toggle rule active status
  const toggleRuleStatusMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      try {
        // This is a stub function since the make_automation_rules table doesn't exist yet
        console.log('Would toggle rule status:', ruleId, isActive);
        return { id: ruleId };
      } catch (error) {
        console.error('Error toggling automation rule status:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['make_automation_rules'] });
      toast({
        title: variables.isActive ? 'Rule activated' : 'Rule deactivated',
        description: `The automation rule was ${variables.isActive ? 'activated' : 'deactivated'} successfully`
      });
    },
    onError: (error) => {
      toast({
        title: 'Error toggling rule status',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  });

  return {
    rules: rules || [],
    isLoading,
    error,
    selectedRuleId,
    setSelectedRuleId,
    createRule: createRuleMutation.mutate,
    updateRule: updateRuleMutation.mutate,
    deleteRule: deleteRuleMutation.mutate,
    toggleRuleStatus: toggleRuleStatusMutation.mutate,
    isCreating: createRuleMutation.isPending,
    isUpdating: updateRuleMutation.isPending,
    isDeleting: deleteRuleMutation.isPending,
    isTogglingStatus: toggleRuleStatusMutation.isPending
  };
}
