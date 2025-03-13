import React from 'react';
import { useMakeWebhooks } from '@/hooks/useMakeWebhooks';
import { MakeWebhookConfig, MakeEventType } from '@/types/make';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, TestTube2, Edit, Copy, Settings } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';
import WebhookDataEditor from '@/components/make/WebhookDataEditor';
import { useMakeTestPayloads } from '@/hooks/useMakeTestPayloads';

interface WebhookFormState {
  name: string;
  url: string;
  description: string;
  event_types: string[];
  is_active: boolean;
  field_selection: Record<string, any> | null;
  payload_template: Record<string, any> | null;
  transformation_code: string | null;
}

// Render a badge with proper children prop
const renderBadge = (children: React.ReactNode, variant: string = "default", className: string = "") => {
  return (
    <Badge variant={variant} className={className}>
      {children}
    </Badge>
  );
};

const WebhookManager = () => {
  const { toast } = useToast();
  const {
    useWebhooks,
    createWebhook,
    updateWebhook,
    toggleWebhook,
    deleteWebhook,
    testWebhook
  } = useMakeWebhooks();
  
  const { data: webhooks, isLoading } = useWebhooks();
  const { data: testPayloads = {} } = useMakeTestPayloads();
  
  const [formState, setFormState] = React.useState<WebhookFormState>({
    name: '',
    url: '',
    description: '',
    event_types: [],
    is_active: true,
    field_selection: null,
    payload_template: null,
    transformation_code: null
  });
  
  const [activeTab, setActiveTab] = React.useState("basic");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isAdvancedDialogOpen, setIsAdvancedDialogOpen] = React.useState(false);
  const [selectedWebhook, setSelectedWebhook] = React.useState<MakeWebhookConfig | null>(null);

  const resetForm = () => {
    setFormState({
      name: '',
      url: '',
      description: '',
      event_types: [],
      is_active: true,
      field_selection: null,
      payload_template: null,
      transformation_code: null
    });
    setEditingId(null);
    setActiveTab("basic");
  };

  const handleCreateOrUpdate = () => {
    if (!formState.name || !formState.url || !formState.event_types.length) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    if (editingId) {
      updateWebhook.mutate({
        id: editingId,
        ...formState
      });
    } else {
      createWebhook.mutate(formState);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (webhook: MakeWebhookConfig) => {
    setFormState({
      name: webhook.name,
      url: webhook.url,
      description: webhook.description || '',
      event_types: webhook.event_types,
      is_active: webhook.is_active || false,
      field_selection: webhook.field_selection || null,
      payload_template: webhook.payload_template || null,
      transformation_code: webhook.transformation_code || null
    });
    setEditingId(webhook.id);
    setIsDialogOpen(true);
  };

  const handleToggle = (id: string, isActive: boolean) => {
    toggleWebhook.mutate({ id, isActive });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this webhook?')) {
      deleteWebhook.mutate(id);
    }
  };

  const handleTest = (id: string) => {
    testWebhook.mutate({ id });
  };
  
  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'URL Copied',
      description: 'Webhook URL copied to clipboard',
    });
  };

  const openAdvancedSettings = (webhook: MakeWebhookConfig) => {
    setSelectedWebhook(webhook);
    setIsAdvancedDialogOpen(true);
  };

  const handleSaveAdvancedSettings = () => {
    if (!selectedWebhook) return;
    
    updateWebhook.mutate({
      id: selectedWebhook.id,
      field_selection: selectedWebhook.field_selection,
      payload_template: selectedWebhook.payload_template,
      transformation_code: selectedWebhook.transformation_code
    });
    
    setIsAdvancedDialogOpen(false);
  };

  if (isLoading) {
    return <div>Loading webhooks...</div>;
  }

  // Extract sample payloads for the WebhookDataEditor
  const samplePayloads: Record<string, any> = {};
  if (testPayloads) {
    Object.entries(testPayloads).forEach(([eventType, payloads]) => {
      if (payloads && Array.isArray(payloads) && payloads.length > 0 && payloads[0]?.payload) {
        samplePayloads[eventType] = payloads[0].payload;
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Webhook' : 'Create New Webhook'}</DialogTitle>
              <DialogDescription>
                Configure webhooks to send events to external systems.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="advanced">Data Selection</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="My Webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    value={formState.url}
                    onChange={(e) => setFormState({ ...formState, url: e.target.value })}
                    placeholder="https://your-webhook-url.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    placeholder="Describe what this webhook is for"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-types">Event Types</Label>
                  <Select
                    value={formState.event_types.join(',')}
                    onValueChange={(value) => setFormState({ 
                      ...formState, 
                      event_types: value ? value.split(',') as string[] : [] 
                    })}
                  >
                    <SelectTrigger id="event-types">
                      <SelectValue placeholder="Select event types" />
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
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-active"
                    checked={formState.is_active}
                    onCheckedChange={(checked) => setFormState({ ...formState, is_active: checked })}
                  />
                  <Label htmlFor="is-active">Active</Label>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="py-4">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Control which data fields are included in webhook payloads, 
                    customize payload format with templates, 
                    or write custom JavaScript transformations.
                  </p>
                  
                  <WebhookDataEditor 
                    eventTypes={formState.event_types as MakeEventType[]}
                    fieldSelection={formState.field_selection}
                    payloadTemplate={formState.payload_template}
                    transformationCode={formState.transformation_code}
                    onFieldSelectionChange={(value) => setFormState({ ...formState, field_selection: value })}
                    onPayloadTemplateChange={(value) => setFormState({ ...formState, payload_template: value })}
                    onTransformationCodeChange={(value) => setFormState({ ...formState, transformation_code: value })}
                    samplePayloads={samplePayloads}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrUpdate}>
                {editingId ? 'Save Changes' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Advanced Settings Dialog */}
        <Dialog open={isAdvancedDialogOpen} onOpenChange={setIsAdvancedDialogOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Advanced Data Settings</DialogTitle>
              <DialogDescription>
                Configure data selection and transformation for webhook: {selectedWebhook?.name}
              </DialogDescription>
            </DialogHeader>
            
            {selectedWebhook && (
              <WebhookDataEditor 
                eventTypes={selectedWebhook.event_types as MakeEventType[]}
                fieldSelection={selectedWebhook.field_selection}
                payloadTemplate={selectedWebhook.payload_template}
                transformationCode={selectedWebhook.transformation_code}
                onFieldSelectionChange={(value) => 
                  setSelectedWebhook({...selectedWebhook, field_selection: value})}
                onPayloadTemplateChange={(value) => 
                  setSelectedWebhook({...selectedWebhook, payload_template: value})}
                onTransformationCodeChange={(value) => 
                  setSelectedWebhook({...selectedWebhook, transformation_code: value})}
                samplePayloads={samplePayloads}
              />
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAdvancedDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAdvancedSettings}>
                Save Advanced Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!webhooks?.length ? (
        <div className="text-center py-8 text-muted-foreground">
          No webhooks configured. Create your first webhook to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{webhook.name}</h3>
                  {renderBadge(
                    webhook.is_active ? "Active" : "Inactive", 
                    webhook.is_active ? "default" : "secondary"
                  )}
                  {(webhook.field_selection || webhook.payload_template || webhook.transformation_code) && 
                    renderBadge("Custom Data", "outline", "bg-purple-100 dark:bg-purple-900/30")
                  }
                </div>
                <p className="text-sm text-muted-foreground">
                  {webhook.description || "No description"}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm">{webhook.url}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyWebhookUrl(webhook.url)}
                    title="Copy URL"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {webhook.event_types.map((type) => (
                    renderBadge(type, "outline", `key-${type}`)
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openAdvancedSettings(webhook)}
                  title="Data Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleTest(webhook.id)}
                  title="Test Webhook"
                >
                  <TestTube2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEdit(webhook)}
                  title="Edit Webhook"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Switch
                  checked={webhook.is_active}
                  onCheckedChange={(checked) => handleToggle(webhook.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(webhook.id)}
                  title="Delete Webhook"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhookManager; 