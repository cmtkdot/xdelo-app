import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MakeEventType } from '@/types/make';
import { Editor } from '@monaco-editor/react';
import { FileJson, RefreshCw, Check } from 'lucide-react';

interface WebhookDataEditorProps {
  eventType: string;
  fieldSelection: string[] | null;
  payloadTemplate: Record<string, any> | null;
  transformationCode: string | null;
  onFieldSelectionChange: (fields: string[]) => void;
  onPayloadTemplateChange: (template: Record<string, any>) => void;
  onTransformationCodeChange: (code: string) => void;
}

// Example data for different event types
const messageReceivedExample = {
  message_id: "uuid-1234",
  chat_id: 123456789,
  chat_title: "Test Channel",
  caption: "Product ABC-123",
  file_id: "telegram-file-id",
  mime_type: "image/jpeg",
  file_size: 1024000,
  media_group_id: "group-123",
  created_at: "2024-01-01T12:00:00Z"
};

const mediaReceivedExample = {
  message_id: "uuid-5678",
  media_type: "photo",
  file_id: "telegram-file-id",
  file_unique_id: "unique-id-123",
  file_size: 2048000,
  mime_type: "image/jpeg",
  width: 1920,
  height: 1080,
  duration: null,
  thumbnail: {
    file_id: "thumb-id",
    file_size: 10240,
    width: 320,
    height: 180
  }
};

const messageEditedExample = {
  message_id: "uuid-9012",
  previous_caption: "Old caption",
  new_caption: "Updated caption",
  edit_date: "2024-01-01T13:00:00Z",
  editor_id: 987654321,
  media_group_id: "group-123"
};

const messageDeletedExample = {
  message_id: "uuid-3456",
  deletion_date: "2024-01-01T14:00:00Z",
  deleter_id: 987654321,
  chat_id: 123456789
};

const mediaGroupExample = {
  media_group_id: "group-123",
  message_ids: ["uuid-1234", "uuid-5678"],
  chat_id: 123456789,
  total_files: 2,
  created_at: "2024-01-01T12:00:00Z"
};

const messageForwardedExample = {
  message_id: "uuid-7890",
  original_chat_id: 123456789,
  original_message_id: "uuid-1234",
  forward_date: "2024-01-01T15:00:00Z",
  forward_from: {
    id: 987654321,
    name: "Original Sender"
  }
};

const captionUpdatedExample = {
  message_id: "uuid-2345",
  previous_caption: "Old caption",
  new_caption: "New caption",
  update_date: "2024-01-01T16:00:00Z",
  updater_id: 987654321,
  media_group_id: "group-123"
};

const processingCompletedExample = {
  message_id: "uuid-6789",
  processing_type: "caption_analysis",
  result: {
    success: true,
    analyzed_content: {
      product_code: "ABC-123",
      quantity: 5,
      price: 99.99
    }
  },
  processing_time: 1.23,
  completed_at: "2024-01-01T17:00:00Z"
};

export function WebhookDataEditor({ 
  eventType,
  fieldSelection,
  payloadTemplate,
  transformationCode,
  onFieldSelectionChange,
  onPayloadTemplateChange,
  onTransformationCodeChange
}: WebhookDataEditorProps) {
  const [activeTab, setActiveTab] = useState('fields');
  const [showExample, setShowExample] = useState(false);

  // Available event types with example data
  const eventTypes = [
    { 
      value: MakeEventType.MESSAGE_RECEIVED, 
      label: 'Message Received',
      example: messageReceivedExample
    },
    { 
      value: MakeEventType.MEDIA_RECEIVED, 
      label: 'Media Received',
      example: mediaReceivedExample
    },
    { 
      value: MakeEventType.MESSAGE_EDITED, 
      label: 'Message Edited',
      example: messageEditedExample
    },
    { 
      value: MakeEventType.MESSAGE_DELETED, 
      label: 'Message Deleted',
      example: messageDeletedExample
    },
    { 
      value: MakeEventType.MEDIA_GROUP_RECEIVED, 
      label: 'Media Group Received',
      example: mediaGroupExample
    },
    { 
      value: MakeEventType.MESSAGE_FORWARDED, 
      label: 'Message Forwarded',
      example: messageForwardedExample
    },
    { 
      value: MakeEventType.CAPTION_UPDATED, 
      label: 'Caption Updated',
      example: captionUpdatedExample
    },
    { 
      value: MakeEventType.PROCESSING_COMPLETED, 
      label: 'Processing Completed',
      example: processingCompletedExample
    }
  ];

  // Get example data for current event type
  const currentExample = eventTypes.find(et => et.value === eventType)?.example || {};

  // Get all possible fields from example data
  const getAllFields = (obj: Record<string, any>, prefix = ''): string[] => {
    return Object.entries(obj).flatMap(([key, value]) => {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return getAllFields(value, currentPath);
      }
      return [currentPath];
    });
  };

  const availableFields = getAllFields(currentExample);

  const handleFieldToggle = (field: string) => {
    const currentFields = fieldSelection || [];
    const newFields = currentFields.includes(field)
      ? currentFields.filter(f => f !== field)
      : [...currentFields, field];
    onFieldSelectionChange(newFields);
  };

  const handleShowExample = () => {
    setShowExample(!showExample);
    if (!showExample && !payloadTemplate) {
      onPayloadTemplateChange(currentExample);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fields">Field Selection</TabsTrigger>
          <TabsTrigger value="template">Payload Template</TabsTrigger>
          <TabsTrigger value="code">Transformation Code</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-4">
            <Label>Available Fields</Label>
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-4 space-y-2">
                {availableFields.map((field) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox
                      id={field}
                      checked={(fieldSelection || []).includes(field)}
                      onCheckedChange={() => handleFieldToggle(field)}
                    />
                    <Label htmlFor={field} className="text-sm">{field}</Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="template" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <Label>Payload Template</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowExample}
              className="flex items-center gap-2"
            >
              {showExample ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Using Example</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Load Example</span>
                </>
              )}
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Editor
              height="400px"
              defaultLanguage="json"
              value={payloadTemplate ? JSON.stringify(payloadTemplate, null, 2) : ''}
              onChange={(value) => {
                try {
                  const parsed = value ? JSON.parse(value) : null;
                  onPayloadTemplateChange(parsed);
                } catch (e) {
                  // Invalid JSON - ignore
                }
              }}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                tabSize: 2,
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="code" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <Label>Transformation Code</Label>
            <div className="flex items-center text-xs text-muted-foreground">
              <FileJson className="h-4 w-4 mr-1" />
              JavaScript
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Editor
              height="400px"
              defaultLanguage="javascript"
              value={transformationCode || ''}
              onChange={(value) => onTransformationCodeChange(value || '')}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                tabSize: 2,
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
