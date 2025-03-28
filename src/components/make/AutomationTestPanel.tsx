import React, { useState, useEffect } from 'react';
import { useMakeAutomations } from '@/hooks/useMakeAutomations';
import { useMakeTestPayloads } from '@/hooks/useMakeTestPayloads';
import { MakeEventType, MakeAutomationRule } from '@/types/make';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, AlertTriangle, Play, Plus, Save, TestTube } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';

const AutomationTestPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('existing');
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [selectedPayloadId, setSelectedPayloadId] = useState<string>('');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [newPayload, setNewPayload] = useState<{
    name: string;
    eventType: string;
    payload: string;
    description: string;
  }>({
    name: '',
    eventType: MakeEventType.MessageReceived,
    payload: '{}',
    description: ''
  });
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  
  const { 
    useTestPayloadsByEventType,
    createTestPayload,
    deleteTestPayload
  } = useMakeTestPayloads();
  
  const {
    useAutomationRules,
    testAutomationRule
  } = useMakeAutomations();
  
  const { toast } = useToast();
  
  const { data: rules = [] } = useAutomationRules();
  const { data: testPayloads = [], isLoading: isLoadingPayloads } = useTestPayloadsByEventType(
    selectedEventType as MakeEventType, 
    !!selectedEventType
  );
  
  // Filter rules by event type
  const filteredRules = selectedEventType 
    ? rules.filter(rule => rule.event_type === selectedEventType)
    : rules;
  
  // Reset selected payload when event type changes
  useEffect(() => {
    setSelectedPayloadId('');
  }, [selectedEventType]);
  
  // Initialize JSON payload editor
  const validateJson = (json: string): boolean => {
    try {
      JSON.parse(json);
      return true;
    } catch (e) {
      return false;
    }
  };
  
  // Handle creating a new test payload
  const handleCreatePayload = async () => {
    if (!newPayload.name.trim()) {
      toast({
        title: "Error",
        description: "Payload name is required",
        variant: "destructive"
      });
      return;
    }
    
    if (!validateJson(newPayload.payload)) {
      toast({
        title: "Error",
        description: "Invalid JSON in payload",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await createTestPayload.mutateAsync({
        name: newPayload.name,
        event_type: newPayload.eventType,
        payload: JSON.parse(newPayload.payload),
        description: newPayload.description,
        is_template: false
      });
      
      toast({
        title: "Success",
        description: "Test payload created successfully"
      });
      
      // Switch to existing tab and select the new payload
      setActiveTab('existing');
      setSelectedEventType(newPayload.eventType);
      
      // Reset form
      setNewPayload({
        name: '',
        eventType: MakeEventType.MessageReceived,
        payload: '{}',
        description: ''
      });
    } catch (error) {
      console.error("Error creating test payload:", error);
      toast({
        title: "Error",
        description: "Failed to create test payload",
        variant: "destructive"
      });
    }
  };
  
  // Handle testing a rule
  const handleTestRule = async () => {
    setIsLoading(true);
    setTestResults(null);
    
    try {
      if (!selectedRuleId) {
        toast({
          title: "Error",
          description: "Please select a rule to test",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Get the selected rule
      const rule = rules.find(r => r.id === selectedRuleId);
      if (!rule) {
        throw new Error("Rule not found");
      }
      
      // Get the payload data
      let payloadData;
      if (activeTab === 'existing') {
        if (!selectedPayloadId) {
          toast({
            title: "Error",
            description: "Please select a test payload",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        
        const payload = testPayloads.find(p => p.id === selectedPayloadId);
        if (!payload) {
          throw new Error("Test payload not found");
        }
        payloadData = payload.payload;
      } else {
        if (!validateJson(newPayload.payload)) {
          toast({
            title: "Error",
            description: "Invalid JSON in payload",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        payloadData = JSON.parse(newPayload.payload);
      }
      
      // Test the rule
      const result = await testAutomationRule.mutateAsync({
        ruleId: rule.id,
        testData: payloadData
      });
      
      setTestResults(result);
    } catch (error) {
      console.error("Error testing rule:", error);
      toast({
        title: "Error",
        description: "Failed to test rule",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate prettier JSON display
  const formatJson = (json: any): string => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return String(json);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Test Automation Rules</CardTitle>
        <CardDescription>
          Test your automation rules against sample data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Step 1: Select Event Type */}
          <div className="space-y-2">
            <Label>1. Select Event Type</Label>
            <Select
              value={selectedEventType}
              onValueChange={setSelectedEventType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(MakeEventType).map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Step 2: Configure Test Payload */}
          <div className="space-y-2">
            <Label>2. Configure Test Payload</Label>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="existing">Use Existing Payload</TabsTrigger>
                <TabsTrigger value="create">Create New Payload</TabsTrigger>
              </TabsList>
              
              <TabsContent value="existing">
                {isLoadingPayloads ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !selectedEventType ? (
                  <div className="text-center text-muted-foreground p-4">
                    Please select an event type first
                  </div>
                ) : testPayloads.length === 0 ? (
                  <div className="text-center p-4 border rounded-md">
                    <TestTube className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No test payloads available for this event type</p>
                    <Button onClick={() => setActiveTab('create')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Payload
                    </Button>
                  </div>
                ) : (
                  <>
                    <Select
                      value={selectedPayloadId}
                      onValueChange={setSelectedPayloadId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select test payload" />
                      </SelectTrigger>
                      <SelectContent>
                        {testPayloads.map((payload) => (
                          <SelectItem key={payload.id} value={payload.id}>{payload.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedPayloadId && (
                      <div className="mt-4 p-4 border rounded-md bg-muted">
                        <h4 className="font-medium mb-1">Payload Preview</h4>
                        <pre className="text-xs overflow-auto max-h-40 p-2 bg-background rounded">
                          {formatJson(testPayloads.find(p => p.id === selectedPayloadId)?.payload)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="create">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="payload-name">Payload Name</Label>
                    <Input
                      id="payload-name"
                      value={newPayload.name}
                      onChange={(e) => setNewPayload({...newPayload, name: e.target.value})}
                      placeholder="Enter a name for this test payload"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="payload-event-type">Event Type</Label>
                    <Select
                      value={newPayload.eventType}
                      onValueChange={(value) => setNewPayload({...newPayload, eventType: value})}
                    >
                      <SelectTrigger id="payload-event-type">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(MakeEventType).map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="payload-description">Description (Optional)</Label>
                    <Input
                      id="payload-description"
                      value={newPayload.description}
                      onChange={(e) => setNewPayload({...newPayload, description: e.target.value})}
                      placeholder="Enter a description"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="payload-json">JSON Payload</Label>
                      <Badge 
                        variant={validateJson(newPayload.payload) ? "default" : "destructive"}
                        className="font-mono"
                      >
                        {validateJson(newPayload.payload) ? "Valid JSON" : "Invalid JSON"}
                      </Badge>
                    </div>
                    <Textarea
                      id="payload-json"
                      value={newPayload.payload}
                      onChange={(e) => setNewPayload({...newPayload, payload: e.target.value})}
                      placeholder="Enter JSON payload"
                      rows={10}
                      className="font-mono"
                    />
                  </div>
                  
                  <Button onClick={handleCreatePayload} disabled={createTestPayload.isPending}>
                    {createTestPayload.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Payload
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Step 3: Select Rule */}
          <div className="space-y-2">
            <Label>3. Select Rule to Test</Label>
            {!selectedEventType ? (
              <div className="text-center text-muted-foreground p-4">
                Please select an event type first
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center p-4 border rounded-md">
                <p className="text-muted-foreground">No rules found for this event type</p>
              </div>
            ) : (
              <Select
                value={selectedRuleId}
                onValueChange={setSelectedRuleId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rule to test" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRules.map((rule) => (
                    <SelectItem key={rule.id} value={rule.id}>{rule.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Test Button */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleTestRule} 
              disabled={isLoading || (!selectedRuleId) || (activeTab === 'existing' && !selectedPayloadId) || (activeTab === 'create' && !validateJson(newPayload.payload))}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </div>
          
          {/* Test Results */}
          {testResults && (
            <div className="mt-8 border rounded-md overflow-hidden">
              <div className={`p-4 flex items-center gap-2 ${testResults.matches ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                {testResults.matches ? (
                  <>
                    <Check className="h-5 w-5" />
                    <h3 className="font-medium">Rule conditions match!</h3>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5" />
                    <h3 className="font-medium">Rule conditions do not match</h3>
                  </>
                )}
              </div>
              
              <div className="p-4">
                <Accordion type="single" collapsible>
                  <AccordionItem value="conditions">
                    <AccordionTrigger>Rule Conditions</AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs overflow-auto max-h-60 p-2 bg-muted rounded">
                        {formatJson(rules.find(r => r.id === selectedRuleId)?.conditions)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="payload">
                    <AccordionTrigger>Test Payload</AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs overflow-auto max-h-60 p-2 bg-muted rounded">
                        {activeTab === 'existing'
                          ? formatJson(testPayloads.find(p => p.id === selectedPayloadId)?.payload)
                          : formatJson(JSON.parse(newPayload.payload))
                        }
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="results">
                    <AccordionTrigger>Test Results</AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs overflow-auto max-h-60 p-2 bg-muted rounded">
                        {formatJson(testResults)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                  
                  {testResults.matches && (
                    <AccordionItem value="actions">
                      <AccordionTrigger>Actions (if triggered)</AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs overflow-auto max-h-60 p-2 bg-muted rounded">
                          {formatJson(rules.find(r => r.id === selectedRuleId)?.actions)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AutomationTestPanel; 