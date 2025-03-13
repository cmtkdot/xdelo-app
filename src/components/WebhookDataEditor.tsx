import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MakeEventType } from '@/types/make';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircleIcon, TrashIcon, RefreshCwIcon } from 'lucide-react';
import CodeEditor from '@/components/CodeEditor';

interface FieldSelectionConfig {
  mode: 'include' | 'exclude';
  fields: string[];
}

interface WebhookDataEditorProps {
  eventTypes: MakeEventType[];
  fieldSelection: Record<string, FieldSelectionConfig> | null;
  payloadTemplate: Record<string, any> | null;
  transformationCode: string | null;
  onFieldSelectionChange: (value: Record<string, FieldSelectionConfig>) => void;
  onPayloadTemplateChange: (value: Record<string, any>) => void;
  onTransformationCodeChange: (value: string) => void;
  samplePayloads?: Record<string, any>;
}

export default function WebhookDataEditor({
  eventTypes,
  fieldSelection = {},
  payloadTemplate = {},
  transformationCode = '',
  onFieldSelectionChange,
  onPayloadTemplateChange,
  onTransformationCodeChange,
  samplePayloads = {}
}: WebhookDataEditorProps) {
  const [activeTab, setActiveTab] = useState('field-selection');
  const [activeEventType, setActiveEventType] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  
  // Initialize active event type if none selected
  useEffect(() => {
    if (eventTypes.length > 0 && !activeEventType) {
      setActiveEventType(eventTypes[0]);
    }
  }, [eventTypes, activeEventType]);
  
  // Get field selection config for current event type
  const getCurrentFieldSelection = (): FieldSelectionConfig => {
    if (!activeEventType || !fieldSelection || !fieldSelection[activeEventType]) {
      return { mode: 'include', fields: [] };
    }
    return fieldSelection[activeEventType];
  };
  
  // Get template for current event type
  const getCurrentTemplate = (): any => {
    if (!activeEventType || !payloadTemplate || !payloadTemplate[activeEventType]) {
      return {};
    }
    return payloadTemplate[activeEventType];
  };
  
  // Update field selection for current event type
  const updateFieldSelection = (config: FieldSelectionConfig) => {
    if (!activeEventType) return;
    
    const newFieldSelection = { ...fieldSelection };
    newFieldSelection[activeEventType] = config;
    onFieldSelectionChange(newFieldSelection);
  };
  
  // Update template for current event type
  const updatePayloadTemplate = (template: any) => {
    if (!activeEventType) return;
    
    const newPayloadTemplate = { ...payloadTemplate };
    newPayloadTemplate[activeEventType] = template;
    onPayloadTemplateChange(newPayloadTemplate);
  };
  
  // Add a new field to the field selection
  const addField = () => {
    const currentConfig = getCurrentFieldSelection();
    updateFieldSelection({
      ...currentConfig,
      fields: [...currentConfig.fields, '']
    });
  };
  
  // Remove a field from field selection
  const removeField = (index: number) => {
    const currentConfig = getCurrentFieldSelection();
    const newFields = [...currentConfig.fields];
    newFields.splice(index, 1);
    updateFieldSelection({
      ...currentConfig,
      fields: newFields
    });
  };
  
  // Update a field in field selection
  const updateField = (index: number, value: string) => {
    const currentConfig = getCurrentFieldSelection();
    const newFields = [...currentConfig.fields];
    newFields[index] = value;
    updateFieldSelection({
      ...currentConfig,
      fields: newFields
    });
  };
  
  // Update selection mode (include/exclude)
  const updateMode = (mode: 'include' | 'exclude') => {
    const currentConfig = getCurrentFieldSelection();
    updateFieldSelection({
      ...currentConfig,
      mode
    });
  };
  
  // Helper to update the template JSON
  const updateTemplateJson = (json: string) => {
    try {
      const parsedJson = JSON.parse(json);
      updatePayloadTemplate(parsedJson);
    } catch (error) {
      console.error('Invalid JSON template', error);
    }
  };
  
  // Generate a preview of the transformed data
  const generatePreview = () => {
    if (!activeEventType) return;
    
    // Get sample payload for the current event type
    const samplePayload = samplePayloads[activeEventType] || {};
    
    // Step 1: Apply field selection
    const currentFieldSelection = getCurrentFieldSelection();
    let previewResult = { ...samplePayload };
    
    if (currentFieldSelection.mode === 'include') {
      // Include only specified fields
      const result: Record<string, any> = {};
      for (const field of currentFieldSelection.fields) {
        if (!field) continue;
        
        const paths = field.split('.');
        let value = samplePayload;
        let valid = true;
        
        for (const path of paths) {
          if (value === undefined || value === null) {
            valid = false;
            break;
          }
          value = value[path];
        }
        
        if (valid) {
          // Handle nested paths (e.g., "user.name")
          let current = result;
          for (let i = 0; i < paths.length - 1; i++) {
            const path = paths[i];
            if (!current[path]) current[path] = {};
            current = current[path];
          }
          current[paths[paths.length - 1]] = value;
        }
      }
      previewResult = result;
    } else if (currentFieldSelection.mode === 'exclude') {
      // Exclude specified fields
      const result = { ...samplePayload };
      for (const field of currentFieldSelection.fields) {
        if (!field) continue;
        
        const paths = field.split('.');
        let current = result;
        
        for (let i = 0; i < paths.length - 1; i++) {
          const path = paths[i];
          if (!current[path]) break;
          current = current[path];
        }
        
        delete current[paths[paths.length - 1]];
      }
      previewResult = result;
    }
    
    // Step 2: Apply template
    const currentTemplate = getCurrentTemplate();
    if (Object.keys(currentTemplate).length > 0) {
      // Function to recursively process template values
      function processTemplate(templateValue: any): any {
        if (typeof templateValue === 'string' && templateValue.startsWith('{{') && templateValue.endsWith('}}')) {
          // Extract the path from the template string (e.g., "{{user.name}}" -> "user.name")
          const path = templateValue.slice(2, -2).trim();
          const paths = path.split('.');
          
          // Resolve the value from the payload
          let value = previewResult;
          for (const p of paths) {
            if (value === undefined || value === null) return null;
            value = value[p];
          }
          return value;
        } else if (typeof templateValue === 'object' && templateValue !== null) {
          // Recursively process object properties
          if (Array.isArray(templateValue)) {
            return templateValue.map(item => processTemplate(item));
          } else {
            const result: Record<string, any> = {};
            for (const [key, value] of Object.entries(templateValue)) {
              result[key] = processTemplate(value);
            }
            return result;
          }
        }
        
        // Return literals unchanged
        return templateValue;
      }
      
      previewResult = processTemplate(currentTemplate);
    }
    
    // Step 3: Apply transformation code (simplified version)
    if (transformationCode) {
      try {
        // Simple and limited evaluation for preview purposes
        const sandboxFunc = new Function('payload', 'eventType', 'context', `
          try {
            ${transformationCode}
            return payload;
          } catch (error) {
            return { error: error.message, originalPayload: payload };
          }
        `);
        
        previewResult = sandboxFunc(previewResult, activeEventType, {});
      } catch (error) {
        previewResult = { 
          error: 'Failed to execute transformation code', 
          message: error.message,
          originalPayload: previewResult 
        };
      }
    }
    
    setPreviewData(previewResult);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-row space-x-4 mb-4">
        <div className="w-1/4">
          <Label>Select Event Type</Label>
          <div className="space-y-2 mt-2">
            {eventTypes.map((eventType) => (
              <div 
                key={eventType}
                className={`p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  activeEventType === eventType ? 'bg-primary/10 font-medium' : ''
                }`}
                onClick={() => setActiveEventType(eventType)}
              >
                {eventType}
              </div>
            ))}
          </div>
        </div>
        
        <div className="w-3/4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="field-selection">Field Selection</TabsTrigger>
              <TabsTrigger value="template">Payload Template</TabsTrigger>
              <TabsTrigger value="transformation">Custom Transformation</TabsTrigger>
            </TabsList>
            
            {/* Field Selection Tab */}
            <TabsContent value="field-selection">
              <Card>
                <CardHeader>
                  <CardTitle>Field Selection</CardTitle>
                  <CardDescription>
                    Choose which fields to include or exclude from the webhook payload.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeEventType && (
                    <>
                      <RadioGroup
                        value={getCurrentFieldSelection().mode}
                        onValueChange={(value) => updateMode(value as 'include' | 'exclude')}
                        className="mb-4"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="include" id="include" />
                            <Label htmlFor="include">Include specified fields</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="exclude" id="exclude" />
                            <Label htmlFor="exclude">Exclude specified fields</Label>
                          </div>
                        </div>
                      </RadioGroup>
                      
                      <div className="space-y-2">
                        {getCurrentFieldSelection().fields.map((field, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Input
                              value={field}
                              onChange={(e) => updateField(index, e.target.value)}
                              placeholder="Field path (e.g. user.name)"
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeField(index)}
                              className="h-8 w-8"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      <Button
                        variant="outline"
                        onClick={addField}
                        className="mt-4"
                      >
                        <PlusCircleIcon className="h-4 w-4 mr-2" />
                        Add Field
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Payload Template Tab */}
            <TabsContent value="template">
              <Card>
                <CardHeader>
                  <CardTitle>Payload Template</CardTitle>
                  <CardDescription>
                    Design a custom structure for the webhook payload with variable substitution.
                    Use {{field.path}} syntax to reference fields from the original payload.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeEventType && (
                    <Textarea
                      value={JSON.stringify(getCurrentTemplate(), null, 2)}
                      onChange={(e) => updateTemplateJson(e.target.value)}
                      className="font-mono h-80"
                      placeholder={`{
  "eventName": "{{event_type}}",
  "data": {
    "id": "{{id}}",
    "user": {
      "name": "{{user.name}}",
      "email": "{{user.email}}"
    }
  }
}`}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Custom Transformation Tab */}
            <TabsContent value="transformation">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Transformation</CardTitle>
                  <CardDescription>
                    Write custom JavaScript code to transform the payload. The code has access to:
                    <ul className="list-disc ml-6 mt-2">
                      <li><code>payload</code>: The current payload object (after field selection and template)</li>
                      <li><code>eventType</code>: The current event type</li>
                      <li><code>context</code>: Additional context provided with the event</li>
                    </ul>
                    Your code should modify the payload object directly and doesn't need a return statement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeEditor
                    value={transformationCode || ''}
                    onChange={onTransformationCodeChange}
                    language="javascript"
                    height="300px"
                    placeholder={`// Example: Add a timestamp
payload.timestamp = new Date().toISOString();

// Example: Format user data
if (payload.user) {
  payload.user.formattedName = \`\${payload.user.firstName} \${payload.user.lastName}\`;
}

// Example: Remove sensitive data
delete payload.internalId;
delete payload.secretKey;`}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Preview Section */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Preview</CardTitle>
                <Button onClick={generatePreview} variant="outline" size="sm">
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Generate Preview
                </Button>
              </div>
              <CardDescription>
                Preview of the transformed payload based on your configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-60">
                <code>{previewData ? JSON.stringify(previewData, null, 2) : 'Click "Generate Preview" to see the result'}</code>
              </pre>
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              This is a simulation based on sample data and may differ from actual webhook payloads.
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
} 