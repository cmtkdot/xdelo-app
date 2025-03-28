
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MakeEventType } from '@/types/make';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import TelegramFieldSelector from './TelegramFieldSelector';

interface WebhookDataEditorProps {
  eventTypes: MakeEventType[];
  fieldSelection: Record<string, any> | null;
  payloadTemplate: Record<string, any> | null;
  transformationCode: string | null;
  onFieldSelectionChange: (value: Record<string, any> | null) => void;
  onPayloadTemplateChange: (value: Record<string, any> | null) => void;
  onTransformationCodeChange: (value: string | null) => void;
  samplePayloads?: Record<string, any>;
}

const WebhookDataEditor: React.FC<WebhookDataEditorProps> = ({
  eventTypes,
  fieldSelection,
  payloadTemplate,
  transformationCode,
  onFieldSelectionChange,
  onPayloadTemplateChange,
  onTransformationCodeChange,
  samplePayloads = {}
}) => {
  const [activeTab, setActiveTab] = useState('fields');
  const [selectedEventType, setSelectedEventType] = useState<MakeEventType | ''>('');

  // Initialize field selection state
  const getFieldSelection = (eventType: string) => {
    if (!fieldSelection || !fieldSelection[eventType]) {
      return {
        mode: 'include' as const,
        fields: []
      };
    }
    return fieldSelection[eventType];
  };

  // Handle field selection changes for a specific event type
  const handleFieldSelectionChange = (eventType: string, mode: 'include' | 'exclude', fields: string[]) => {
    const newFieldSelection = {
      ...(fieldSelection || {}),
      [eventType]: {
        mode,
        fields
      }
    };
    onFieldSelectionChange(newFieldSelection);
  };

  // Get a sample payload for the selected event type
  const getSamplePayload = (eventType: string) => {
    return samplePayloads[eventType] || {
      message: "Sample payload for " + eventType,
      timestamp: new Date().toISOString()
    };
  };

  // Get template for the selected event type
  const getTemplate = (eventType: string) => {
    if (!payloadTemplate || !payloadTemplate[eventType]) {
      return '';
    }
    return JSON.stringify(payloadTemplate[eventType], null, 2);
  };

  // Handle template changes for a specific event type
  const handleTemplateChange = (eventType: string, templateJson: string) => {
    try {
      const templateObject = JSON.parse(templateJson);
      const newTemplate = {
        ...(payloadTemplate || {}),
        [eventType]: templateObject
      };
      onPayloadTemplateChange(newTemplate);
    } catch (e) {
      // Don't update if JSON is invalid
      console.error('Invalid JSON template:', e);
    }
  };

  // Determine if the current event type is Telegram-related
  const isTelegramEvent = (eventType: string) => {
    return [
      MakeEventType.MessageReceived,
      MakeEventType.MediaReceived,
      MakeEventType.MessageEdited,
      MakeEventType.MessageDeleted,
      MakeEventType.MediaGroupReceived,
      MakeEventType.MessageForwarded,
      MakeEventType.CaptionUpdated,
      MakeEventType.ProcessingCompleted
    ].includes(eventType as MakeEventType);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-type">Select Event Type</Label>
        <Select
          value={selectedEventType}
          onValueChange={(value) => setSelectedEventType(value as MakeEventType)}
        >
          <SelectTrigger id="event-type">
            <SelectValue placeholder="Select an event type to configure" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select an event type</SelectItem>
            {eventTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedEventType && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fields">Field Selection</TabsTrigger>
            <TabsTrigger value="template">Payload Template</TabsTrigger>
            <TabsTrigger value="transform">Transformation Code</TabsTrigger>
          </TabsList>

          <TabsContent value="fields">
            <Card>
              <CardHeader>
                <CardTitle>Field Selection</CardTitle>
                <CardDescription>
                  Choose which fields to include in the webhook payload
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isTelegramEvent(selectedEventType) ? (
                  <TelegramFieldSelector 
                    selectedFields={getFieldSelection(selectedEventType).fields}
                    onChange={(fields) => 
                      handleFieldSelectionChange(
                        selectedEventType, 
                        getFieldSelection(selectedEventType).mode, 
                        fields
                      )
                    }
                    mode={getFieldSelection(selectedEventType).mode}
                    onModeChange={(mode) => 
                      handleFieldSelectionChange(
                        selectedEventType, 
                        mode, 
                        getFieldSelection(selectedEventType).fields
                      )
                    }
                  />
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    Field selection for non-Telegram events is not currently available.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="template">
            <Card>
              <CardHeader>
                <CardTitle>Payload Template</CardTitle>
                <CardDescription>
                  Create a custom JSON template for the webhook payload. Use {'{{'}<span>field.path</span>{'}}'}  syntax to reference fields.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sample Payload</Label>
                    <Textarea
                      value={JSON.stringify(getSamplePayload(selectedEventType), null, 2)}
                      readOnly
                      rows={15}
                      className="font-mono text-sm bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Template</Label>
                    <Textarea
                      value={getTemplate(selectedEventType)}
                      onChange={(e) => handleTemplateChange(selectedEventType, e.target.value)}
                      placeholder={'{\n  "event": "{{event_type}}",\n  "data": {\n    "message": "{{message.text}}"\n  }\n}'}
                      rows={15}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transform">
            <Card>
              <CardHeader>
                <CardTitle>Transformation Code</CardTitle>
                <CardDescription>
                  Write custom JavaScript code to transform the payload. The code has access to 'payload', 'eventType', and 'context' variables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={transformationCode || ''}
                  onChange={(e) => onTransformationCodeChange(e.target.value)}
                  placeholder={`// Example: Add a timestamp and format data
payload.processed_at = new Date().toISOString();

// Example: Rename fields
if (payload.message) {
  payload.content = payload.message;
  delete payload.message;
}

// Example: Compute new values
if (payload.file_size) {
  payload.file_size_mb = (payload.file_size / (1024 * 1024)).toFixed(2);
}

// Return modified payload is handled automatically`}
                  rows={15}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default WebhookDataEditor;
