import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMakeAutomations } from '@/hooks/useMakeAutomations';
import { MakeEventType, MakeAutomationRule, MakeCondition, MakeAction } from '@/types/make';
import { Plus, Trash2, Save } from 'lucide-react';

interface AutomationFormProps {
  rule: MakeAutomationRule | null;
  onClose: () => void;
}

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' }
];

const ACTION_TYPES = [
  { value: 'forward_webhook', label: 'Forward to Webhook' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'modify_data', label: 'Modify Data' },
  { value: 'store_media', label: 'Store Media' },
  { value: 'transform_message', label: 'Transform Message' }
];

const FIELD_OPTIONS = [
  'message.text',
  'message.chat.id',
  'message.from.id',
  'message.from.username',
  'media.file_id',
  'media.mime_type',
  'media.file_size',
  'webhook.event_type',
  'webhook.source',
  'custom.field'
];

const eventTypeOptions = [
  { value: MakeEventType.MESSAGE_RECEIVED, label: 'Message Received' },
  { value: MakeEventType.CHANNEL_JOINED, label: 'Channel Joined' },
  { value: MakeEventType.PRODUCT_CREATED, label: 'Product Created' },
  { value: MakeEventType.ORDER_UPDATED, label: 'Order Updated' },
  { value: MakeEventType.INVOICE_PAID, label: 'Invoice Paid' },
];

const getFieldTypeOptions = (eventType: string) => {
  switch (eventType) {
    case MakeEventType.MESSAGE_RECEIVED:
      return [
        { value: 'caption', label: 'Caption' },
        { value: 'chat_title', label: 'Chat Title' },
        { value: 'media_group_id', label: 'Media Group ID' },
        { value: 'file_size', label: 'File Size' },
        { value: 'mime_type', label: 'MIME Type' },
      ];
    // ... other cases
    default:
      return [];
  }
};

const AutomationForm = ({ rule, onClose }: AutomationFormProps) => {
  const { createAutomationRule, updateAutomationRule } = useMakeAutomations();
  
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    event_type: MakeEventType.MessageReceived,
    is_active: true,
    priority: 0,
    conditions: [{ field: '', operator: 'equals', value: '' }] as MakeCondition[],
    actions: [{ type: 'forward_webhook', config: { url: '', headers: {} } }] as MakeAction[]
  });
  
  useEffect(() => {
    if (rule) {
      setFormState({
        name: rule.name || '',
        description: rule.description || '',
        event_type: rule.event_type as MakeEventType || MakeEventType.MessageReceived,
        is_active: rule.is_active ?? true,
        priority: rule.priority ?? 0,
        conditions: rule.conditions || [{ field: '', operator: 'equals', value: '' }],
        actions: rule.actions || [{ type: 'forward_webhook', config: { url: '', headers: {} } }]
      });
    }
  }, [rule]);
  
  const handleInputChange = (field: string, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };
  
  const handleAddCondition = () => {
    setFormState(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }]
    }));
  };
  
  const handleRemoveCondition = (index: number) => {
    setFormState(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };
  
  const handleConditionChange = (index: number, field: keyof MakeCondition, value: any) => {
    setFormState(prev => {
      const newConditions = [...prev.conditions];
      newConditions[index] = { ...newConditions[index], [field]: value };
      return { ...prev, conditions: newConditions };
    });
  };
  
  const handleAddAction = () => {
    setFormState(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'forward_webhook', config: { url: '', headers: {} } }]
    }));
  };
  
  const handleRemoveAction = (index: number) => {
    setFormState(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };
  
  const handleActionChange = (index: number, field: keyof MakeAction, value: any) => {
    setFormState(prev => {
      const newActions = [...prev.actions];
      newActions[index] = { ...newActions[index], [field]: value };
      return { ...prev, actions: newActions };
    });
  };
  
  const handleActionConfigChange = (index: number, field: string, value: any) => {
    setFormState(prev => {
      const newActions = [...prev.actions];
      newActions[index].config = { 
        ...newActions[index].config, 
        [field]: value 
      };
      return { ...prev, actions: newActions };
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formState.name.trim()) {
      alert('Name is required');
      return;
    }
    
    const automationData = {
      name: formState.name,
      description: formState.description,
      event_type: formState.event_type,
      conditions: formState.conditions,
      actions: formState.actions,
      is_active: formState.is_active,
      priority: formState.priority
    };
    
    try {
      if (rule) {
        await updateAutomationRule.mutateAsync({
          id: rule.id,
          ...automationData
        });
      } else {
        await createAutomationRule.mutateAsync(automationData);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving automation rule:', error);
      alert('Failed to save automation rule');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-0 shadow-none">
        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter a name for this rule"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="event-type">Event Type</Label>
              <Select
                value={formState.event_type}
                onValueChange={(value) => handleInputChange('event_type', value as MakeEventType)}
              >
                <SelectTrigger id="event-type">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(MakeEventType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formState.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe the purpose of this automation rule"
              rows={2}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={formState.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                className="w-24"
                value={formState.priority}
                onChange={(e) => handleInputChange('priority', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Conditions</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddCondition}>
                <Plus className="h-4 w-4 mr-1" />
                Add Condition
              </Button>
            </div>
            
            {formState.conditions.map((condition, index) => (
              <div key={index} className="p-4 border rounded-md">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Condition {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCondition(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`condition-${index}-field`}>Field</Label>
                    <Select
                      value={condition.field}
                      onValueChange={(value) => handleConditionChange(index, 'field', value)}
                    >
                      <SelectTrigger id={`condition-${index}-field`}>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFieldTypeOptions(formState.event_type).map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`condition-${index}-operator`}>Operator</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) => handleConditionChange(index, 'operator', value)}
                    >
                      <SelectTrigger id={`condition-${index}-operator`}>
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`condition-${index}-value`}>Value</Label>
                    <Input
                      id={`condition-${index}-value`}
                      value={String(condition.value)}
                      onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                      placeholder="Enter comparison value"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Actions</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddAction}>
                <Plus className="h-4 w-4 mr-1" />
                Add Action
              </Button>
            </div>
            
            {formState.actions.map((action, index) => (
              <div key={index} className="p-4 border rounded-md">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Action {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAction(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`action-${index}-type`}>Action Type</Label>
                    <Select
                      value={action.type}
                      onValueChange={(value) => handleActionChange(index, 'type', value)}
                    >
                      <SelectTrigger id={`action-${index}-type`}>
                        <SelectValue placeholder="Select action type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {action.type === 'forward_webhook' && (
                    <div className="space-y-2">
                      <Label htmlFor={`action-${index}-webhook-url`}>Webhook URL</Label>
                      <Input
                        id={`action-${index}-webhook-url`}
                        value={action.config?.url || ''}
                        onChange={(e) => handleActionConfigChange(index, 'url', e.target.value)}
                        placeholder="Enter webhook URL"
                      />
                    </div>
                  )}
                  
                  {action.type === 'send_notification' && (
                    <div className="space-y-2">
                      <Label htmlFor={`action-${index}-notification-message`}>Notification Message</Label>
                      <Textarea
                        id={`action-${index}-notification-message`}
                        value={action.config?.message || ''}
                        onChange={(e) => handleActionConfigChange(index, 'message', e.target.value)}
                        placeholder="Enter notification message"
                      />
                    </div>
                  )}
                  
                  {action.type === 'modify_data' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`action-${index}-data-path`}>Data Path</Label>
                        <Input
                          id={`action-${index}-data-path`}
                          value={action.config?.path || ''}
                          onChange={(e) => handleActionConfigChange(index, 'path', e.target.value)}
                          placeholder="e.g., message.text"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`action-${index}-data-value`}>New Value</Label>
                        <Input
                          id={`action-${index}-data-value`}
                          value={action.config?.value || ''}
                          onChange={(e) => handleActionConfigChange(index, 'value', e.target.value)}
                          placeholder="Enter new value"
                        />
                      </div>
                    </div>
                  )}
                  
                  {action.type === 'store_media' && (
                    <div className="space-y-2">
                      <Label htmlFor={`action-${index}-storage-path`}>Storage Path</Label>
                      <Input
                        id={`action-${index}-storage-path`}
                        value={action.config?.path || ''}
                        onChange={(e) => handleActionConfigChange(index, 'path', e.target.value)}
                        placeholder="e.g., media/telegram/{message.chat.id}"
                      />
                    </div>
                  )}
                  
                  {action.type === 'transform_message' && (
                    <div className="space-y-2">
                      <Label htmlFor={`action-${index}-transform-template`}>Template</Label>
                      <Textarea
                        id={`action-${index}-transform-template`}
                        value={action.config?.template || ''}
                        onChange={(e) => handleActionConfigChange(index, 'template', e.target.value)}
                        placeholder="Enter message template"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Save className="h-4 w-4 mr-2" />
            {rule ? 'Update' : 'Create'} Rule
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default AutomationForm;
