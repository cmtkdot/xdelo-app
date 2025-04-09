
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeEventType } from '@/types/make';
import { useToast } from '@/hooks/useToast';
import { Database } from '@/integrations/supabase/database.types';

interface TestPayload {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  payload: any;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

type TestPayloadInsert = Omit<TestPayload, 'id' | 'created_at' | 'updated_at'>;
type MakeTestPayloadRow = Database['public']['Tables']['make_test_payloads']['Row'];

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
      queryFn: async (): Promise<Record<string, TestPayload[]>> => {
        const { data, error } = await supabase
          .from('make_test_payloads')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Group by event type
        return data.reduce((acc, payload: MakeTestPayloadRow) => {
          if (!acc[payload.event_type]) {
            acc[payload.event_type] = [];
          }
          acc[payload.event_type].push(payload as unknown as TestPayload);
          return acc;
        }, {} as Record<string, TestPayload[]>);
      },
      enabled,
    });

  // Fetch template payloads
  const useTemplatePayloads = (enabled = true) => 
    useQuery({
      queryKey: ['make-template-payloads'],
      queryFn: async (): Promise<Record<string, TestPayload[]>> => {
        const { data, error } = await supabase
          .from('make_test_payloads')
          .select('*')
          .eq('is_template', true)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Group by event type
        return data.reduce((acc, payload: MakeTestPayloadRow) => {
          if (!acc[payload.event_type]) {
            acc[payload.event_type] = [];
          }
          acc[payload.event_type].push(payload as unknown as TestPayload);
          return acc;
        }, {} as Record<string, TestPayload[]>);
      },
      enabled,
    });

  // Fetch test payloads by event type
  const useTestPayloadsByEventType = (eventType: MakeEventType, enabled = true) =>
    useQuery({
      queryKey: ['make-test-payloads', eventType],
      queryFn: async (): Promise<TestPayload[]> => {
        const { data, error } = await supabase
          .from('make_test_payloads')
          .select('*')
          .eq('event_type', eventType)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as unknown as TestPayload[];
      },
      enabled,
    });

  // Create a new test payload
  const createTestPayload = useMutation({
    mutationFn: async (payload: TestPayloadInsert) => {
      const { data, error } = await supabase
        .from('make_test_payloads')
        .insert({
          name: payload.name,
          description: payload.description,
          event_type: payload.event_type,
          payload: payload.payload,
          is_template: payload.is_template,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as TestPayload;
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
    mutationFn: async (payload: Partial<TestPayload> & { id: string }) => {
      const { data, error } = await supabase
        .from('make_test_payloads')
        .update({
          name: payload.name,
          description: payload.description,
          event_type: payload.event_type,
          payload: payload.payload,
          is_template: payload.is_template
        })
        .eq('id', payload.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as TestPayload;
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
      const { error } = await supabase
        .from('make_test_payloads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
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
      const templates = Object.values(MakeEventType).map(eventType => {
        let templatePayload: any;
        
        switch(eventType) {
          case MakeEventType.MESSAGE_RECEIVED:
            templatePayload = {
              message: {
                id: "msg_123456",
                text: "Hello, this is a sample message",
                timestamp: new Date().toISOString(),
              },
              sender: {
                id: "user_123",
                name: "Sample User",
                email: "user@example.com"
              },
              channel: {
                id: "channel_456",
                name: "general"
              },
              metadata: {
                tags: ["important", "customer"],
                source: "web"
              }
            };
            break;
            
          case MakeEventType.CHANNEL_JOINED:
            templatePayload = {
              channel: {
                id: "channel_456",
                name: "general",
                description: "Main channel for team communication"
              },
              user: {
                id: "user_123",
                name: "Sample User",
                email: "user@example.com"
              },
              timestamp: new Date().toISOString(),
              invited_by: {
                id: "user_789",
                name: "Admin User"
              }
            };
            break;
            
          // Add more case statements for other event types
          
          default:
            templatePayload = {
              event_type: eventType,
              timestamp: new Date().toISOString(),
              sample_data: "This is a generic template for " + eventType
            };
        }
        
        return {
          name: `Default ${eventType} Template`,
          description: `Default template for ${eventType} events`,
          event_type: eventType as string,
          payload: templatePayload,
          is_template: true
        };
      });
      
      // Insert all templates
      const { data, error } = await supabase
        .from('make_test_payloads')
        .insert(templates as any)
        .select();
      
      if (error) throw error;
      return data;
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
