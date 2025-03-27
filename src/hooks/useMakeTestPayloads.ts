
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeEventType } from '@/types/make';
import { useToast } from '@/hooks/useToast';

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

/**
 * Hook to manage test payloads for Make webhooks
 * Note: This is a placeholder implementation - the actual tables need to be created
 */
export function useMakeTestPayloads() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mock data for now - to be replaced with actual database calls once tables are created
  const mockPayloads: Record<string, TestPayload[]> = {
    message_received: [
      {
        id: "1",
        name: "Sample Message",
        description: "A sample message for testing",
        event_type: "message_received",
        payload: { message: "Test message", timestamp: new Date().toISOString() },
        is_template: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  };

  // Fetch all test payloads grouped by event type
  const useTestPayloads = (enabled = true) => 
    useQuery({
      queryKey: ['make-test-payloads'],
      queryFn: async (): Promise<Record<string, TestPayload[]>> => {
        // Mock implementation
        return mockPayloads;
      },
      enabled,
    });

  // Fetch template payloads
  const useTemplatePayloads = (enabled = true) => 
    useQuery({
      queryKey: ['make-template-payloads'],
      queryFn: async (): Promise<Record<string, TestPayload[]>> => {
        // Mock implementation
        return Object.entries(mockPayloads).reduce((acc, [key, payloads]) => {
          acc[key] = payloads.filter(p => p.is_template);
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
        // Mock implementation
        return mockPayloads[eventType] || [];
      },
      enabled,
    });

  // Create a new test payload
  const createTestPayload = useMutation({
    mutationFn: async (payload: Omit<TestPayload, 'id' | 'created_at' | 'updated_at'>) => {
      // Mock implementation
      const newId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const newPayload = {
        ...payload,
        id: newId,
        created_at: timestamp,
        updated_at: timestamp
      };
      
      if (!mockPayloads[payload.event_type]) {
        mockPayloads[payload.event_type] = [];
      }
      
      mockPayloads[payload.event_type].push(newPayload);
      return newPayload;
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
      // Mock implementation
      let found = false;
      
      Object.keys(mockPayloads).forEach(key => {
        const index = mockPayloads[key].findIndex(p => p.id === payload.id);
        if (index >= 0) {
          mockPayloads[key][index] = {
            ...mockPayloads[key][index],
            ...payload,
            updated_at: new Date().toISOString()
          };
          found = true;
        }
      });
      
      if (!found) {
        throw new Error('Payload not found');
      }
      
      return payload;
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
      // Mock implementation
      let found = false;
      
      Object.keys(mockPayloads).forEach(key => {
        const index = mockPayloads[key].findIndex(p => p.id === id);
        if (index >= 0) {
          mockPayloads[key].splice(index, 1);
          found = true;
        }
      });
      
      if (!found) {
        throw new Error('Payload not found');
      }
      
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
      // Mock implementation
      const templates = Object.values(MakeEventType).map(eventType => {
        let templatePayload: any;
        
        switch(eventType) {
          case 'message_received':
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
            
          case 'channel_joined':
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
        
        // Create test payload
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const template = {
          id,
          name: `Default ${eventType} Template`,
          description: `Default template for ${eventType} events`,
          event_type: eventType,
          payload: templatePayload,
          is_template: true,
          created_at: timestamp,
          updated_at: timestamp
        };
        
        if (!mockPayloads[eventType]) {
          mockPayloads[eventType] = [];
        }
        
        mockPayloads[eventType].push(template);
        return template;
      });
      
      return templates;
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
