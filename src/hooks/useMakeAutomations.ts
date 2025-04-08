import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeAutomationRule, MakeEventType, MakeRuleCondition, MakeRuleAction } from '@/types/make';
import { useToast } from '@/hooks/useToast';

/**
 * Hook to manage Make automation rules
 */
export function useMakeAutomations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper function to convert DB records to MakeAutomationRule
  const transformAutomationRules = (data: any[]): MakeAutomationRule[] => {
    return data.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || null,
      event_type: rule.event_type as MakeEventType | string,
      conditions: Array.isArray(rule.conditions) ? rule.conditions.map((c: any) => ({
        field: c.field,
        operator: c.operator,
        value: c.value
      })) : [],
      actions: Array.isArray(rule.actions) ? rule.actions.map((a: any) => ({
        type: a.type,
        config: a.config || {}
      })) : [],
      is_active: rule.is_active ?? false,
      priority: rule.priority ?? 0,
      created_at: rule.created_at || null,
      updated_at: rule.updated_at || null
    }));
  };

  // Fetch all automation rules
  const useAutomationRules = (enabled = true) => 
    useQuery({
      queryKey: ['make-automation-rules'],
      queryFn: async (): Promise<MakeAutomationRule[]> => {
        // Mock response for now - table doesn't exist yet
        console.log('Fetching automation rules (mock)');
        return [];
      },
      enabled,
    });

  // Fetch automation rules by event type
  const useAutomationRulesByEventType = (eventType: string, enabled = true) =>
    useQuery({
      queryKey: ['make-automation-rules', eventType],
      queryFn: async (): Promise<MakeAutomationRule[]> => {
        // Mock response for now - table doesn't exist yet
        console.log('Fetching automation rules by event type (mock):', eventType);
        return [];
      },
      enabled: !!eventType && enabled,
    });

  // Create a new automation rule
  const createAutomationRule = useMutation({
    mutationFn: async (rule: Omit<MakeAutomationRule, 'id' | 'created_at' | 'updated_at'>) => {
      // Mock response for now - table doesn't exist yet
      console.log('Creating automation rule (mock):', rule);
      return {
        ...rule,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as MakeAutomationRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-automation-rules'] });
      toast({
        title: 'Success',
        description: 'Automation rule created',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create automation rule: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Update an automation rule
  const updateAutomationRule = useMutation({
    mutationFn: async (rule: Partial<MakeAutomationRule> & { id: string }) => {
      // Mock response for now - table doesn't exist yet
      console.log('Updating automation rule (mock):', rule);
      return {
        id: rule.id,
        name: rule.name || 'Unnamed Rule',
        description: rule.description,
        event_type: rule.event_type || MakeEventType.MESSAGE_RECEIVED,
        conditions: rule.conditions || [],
        actions: rule.actions || [],
        is_active: rule.is_active ?? true,
        priority: rule.priority ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as MakeAutomationRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-automation-rules'] });
      toast({
        title: 'Success',
        description: 'Automation rule updated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update automation rule: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Toggle an automation rule's active state
  const toggleAutomationRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data, error } = await (supabase as any)
        .from('make_automation_rules')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Convert back to MakeAutomationRule
      return transformAutomationRules([data])[0];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['make-automation-rules'] });
      toast({
        title: 'Success',
        description: `Automation rule ${data.is_active ? 'activated' : 'deactivated'}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to toggle automation rule: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Delete an automation rule
  const deleteAutomationRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('make_automation_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['make-automation-rules'] });
      toast({
        title: 'Success',
        description: 'Automation rule deleted',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete automation rule: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Reorder automation rules
  const reorderAutomationRules = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      // Implement reordering logic via RPC
      const { error } = await (supabase as any).rpc('reorder_make_automation_rules', {
        rule_ids: ruleIds,
      });
      
      if (error) throw error;
      return ruleIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-automation-rules'] });
      toast({
        title: 'Success',
        description: 'Automation rules reordered',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to reorder automation rules: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Add the testAutomationRule mutation
  const testAutomationRule = useMutation({
    mutationFn: async ({ ruleId, testData }: { ruleId: string; testData: any }) => {
      // Get the rule by ID first to obtain its conditions and actions
      const { data: rule, error: ruleError } = await (supabase as any)
        .from('make_automation_rules')
        .select('*')
        .eq('id', ruleId)
        .single();
      
      if (ruleError) throw ruleError;
      
      // Create payload for the test
      const testPayload = {
        rule: {
          conditions: rule.conditions,
          actions: rule.actions,
          eventType: rule.event_type
        },
        testData,
        correlationId: crypto.randomUUID().toString()
      };
      
      // Call the test handler
      const { data, error } = await supabase.functions.invoke('make_automation_manager', {
        body: {
          action: 'test',
          ...testPayload
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.matches) {
        toast({
          title: 'Success',
          description: 'Rule conditions match the test data!',
        });
      } else {
        toast({
          title: 'Info',
          description: 'Rule conditions do not match the test data.',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to test rule: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  return {
    useAutomationRules,
    useAutomationRulesByEventType,
    createAutomationRule,
    updateAutomationRule,
    toggleAutomationRule,
    deleteAutomationRule,
    reorderAutomationRules,
    testAutomationRule,
  };
}
