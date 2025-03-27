// Partial fix for the WebhookManager component
// Only updating the error-causing parts

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Plus, Edit, Trash2, Copy, Check } from 'lucide-react';
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MakeWebhookConfig } from '@/types/make';
import { useMakeWebhooks } from '@/hooks/useMakeWebhooks';
import { WebhookDataEditor } from './WebhookDataEditor';
import { Collapsible } from '@/components/ui/collapsible';
import { RetryConfigEditor } from './RetryConfigEditor';
import { HeaderEditor } from './HeaderEditor';

// Define the form state interface to match the expected structure
interface WebhookFormState {
  id?: string;
  name: string;
  url: string;
  description: string;
  event_type: string; // Changed from event_types to event_type
  is_active: boolean;
  field_selection: string[] | null;
  payload_template: Record<string, any> | null;
  transformation_code: string | null;
  headers?: Record<string, string> | null;
  retry_config?: {
    max_attempts?: number;
    backoff_factor?: number;
    initial_delay?: number;
  } | null;
}

// Define the form schema using Zod
const formSchema = z.object({
  name: z.string().min(2, {
    message: "Webhook name must be at least 2 characters.",
  }),
  url: z.string().url({
    message: "Please enter a valid URL.",
  }),
  description: z.string().optional(),
  event_type: z.string().min(1, {
    message: "Please select an event type.",
  }),
  is_active: z.boolean().default(false),
  field_selection: z.array(z.string()).nullable().default(null),
  payload_template: z.record(z.any()).nullable().default(null),
  transformation_code: z.string().nullable().default(null),
  headers: z.record(z.string()).nullable().default(null),
  retry_config: z.object({
    max_attempts: z.number().optional(),
    backoff_factor: z.number().optional(),
    initial_delay: z.number().optional(),
  }).nullable().default(null),
})

export function WebhookManager() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentWebhook, setCurrentWebhook] = useState<MakeWebhookConfig | null>(null);
  const [formState, setFormState] = useState<WebhookFormState>({
    name: '',
    url: '',
    description: '',
    event_type: '',
    is_active: false,
    field_selection: null,
    payload_template: null,
    transformation_code: null,
    headers: null,
    retry_config: null
  });
  const [isCopied, setIsCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  
  const {
    useWebhooks,
    createWebhookMutation,
    updateWebhookMutation,
    deleteWebhookMutation,
    toggleWebhookMutation
  } = useMakeWebhooks();
  
  const { data: webhooks, isLoading, refetch } = useWebhooks();
  
  // Initialize the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      event_type: "",
      is_active: false,
      field_selection: null,
      payload_template: null,
      transformation_code: null,
      headers: null,
      retry_config: null
    },
    mode: "onChange",
  })
  
  useEffect(() => {
    if (currentWebhook) {
      form.reset({
        name: currentWebhook.name,
        url: currentWebhook.url,
        description: currentWebhook.description || "",
        event_type: currentWebhook.event_type,
        is_active: currentWebhook.is_active,
        field_selection: currentWebhook.field_selection,
        payload_template: currentWebhook.payload_template,
        transformation_code: currentWebhook.transformation_code,
        headers: currentWebhook.headers,
        retry_config: currentWebhook.retry_config
      });
    }
  }, [currentWebhook, form]);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const resetForm = () => {
    form.reset();
    setFormState({
      name: '',
      url: '',
      description: '',
      event_type: '',
      is_active: false,
      field_selection: null,
      payload_template: null,
      transformation_code: null,
      headers: null,
      retry_config: null
    });
  };
  
  // Delete webhook
  const deleteWebhook = async (id: string) => {
    try {
      await deleteWebhookMutation.mutateAsync(id);
      toast({
        title: 'Success',
        description: 'Webhook deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete webhook',
        variant: 'destructive',
      });
    }
  };
  
  // Toggle webhook active state
  const toggleWebhook = async (id: string, isActive: boolean) => {
    try {
      await toggleWebhookMutation.mutateAsync({ id, isActive });
      toast({
        title: 'Success',
        description: `Webhook ${isActive ? 'deactivated' : 'activated'}`,
      });
    } catch (error) {
      console.error('Error toggling webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle webhook',
        variant: 'destructive',
      });
    }
  };

  // Update webhook
  const updateWebhook = async (webhook: Partial<MakeWebhookConfig> & { id: string }) => {
    try {
      setUpdating(true);
      await updateWebhookMutation.mutateAsync(webhook);
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error('Error updating webhook:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Create webhook
  const createWebhook = async (webhookData: Omit<MakeWebhookConfig, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setCreating(true);
      await createWebhookMutation.mutateAsync(webhookData);
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating webhook:', error);
    } finally {
      setCreating(false);
    }
  };

  // Handle form submission for creating a webhook
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createWebhook(data);
  };

  // Handle form submission for updating a webhook
  const onEditSubmit = (data: z.infer<typeof formSchema>) => {
    if (currentWebhook) {
      updateWebhook({ id: currentWebhook.id, ...data });
    }
  };

  // Convert to the correct form for editing
  const editWebhook = (webhook: MakeWebhookConfig) => {
    setCurrentWebhook(webhook);
    setFormState({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      description: webhook.description || '',
      event_type: webhook.event_type, // Changed from event_types
      is_active: webhook.is_active,
      field_selection: webhook.field_selection,
      payload_template: webhook.payload_template,
      transformation_code: webhook.transformation_code,
      headers: webhook.headers,
      retry_config: webhook.retry_config
    });
    setShowEditModal(true);
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Make.com Webhooks</CardTitle>
          <CardDescription>
            Manage your Make.com webhooks here.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </div>
          
          {isLoading ? (
            <p>Loading webhooks...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks?.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell>{webhook.event_type}</TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={(checked) => toggleWebhook(webhook.id, !checked)}
                        id={`active-${webhook.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editWebhook(webhook)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWebhook(webhook.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Add Webhook Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Create a new webhook to listen for events from Make.com.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Webhook Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/webhook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description of the webhook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="event_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="message_received">Message Received</SelectItem>
                        <SelectItem value="channel_joined">Channel Joined</SelectItem>
                        <SelectItem value="product_created">Product Created</SelectItem>
                        <SelectItem value="order_updated">Order Updated</SelectItem>
                        <SelectItem value="invoice_paid">Invoice Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable or disable this webhook.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Webhook'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Webhook Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>
              Edit the details of your webhook.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Webhook Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/webhook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description of the webhook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="event_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="message_received">Message Received</SelectItem>
                        <SelectItem value="channel_joined">Channel Joined</SelectItem>
                        <SelectItem value="product_created">Product Created</SelectItem>
                        <SelectItem value="order_updated">Order Updated</SelectItem>
                        <SelectItem value="invoice_paid">Invoice Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable or disable this webhook.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />

              <WebhookDataEditor 
                eventType={formState.event_type}
                fieldSelection={formState.field_selection}
                payloadTemplate={formState.payload_template}
                transformationCode={formState.transformation_code}
                onFieldSelectionChange={(value) => setFormState({...formState, field_selection: value})}
                onPayloadTemplateChange={(value) => setFormState({...formState, payload_template: value})}
                onTransformationCodeChange={(value) => setFormState({...formState, transformation_code: value})}
              />

              <Collapsible className="w-full">
                <Button variant="link" size="sm" className="justify-start">
                  Advanced Options
                </Button>
                <div className="mt-3 space-y-2">
                  <HeaderEditor 
                    headers={formState.headers || {}}
                    onChange={(value) => setFormState({...formState, headers: value})}
                  />
                  <RetryConfigEditor 
                    retryConfig={formState.retry_config || {}}
                    onChange={(value) => setFormState({...formState, retry_config: value})}
                  />
                </div>
              </Collapsible>
              
              <DialogFooter>
                <Button type="submit" disabled={updating}>
                  {updating ? 'Updating...' : 'Update Webhook'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
