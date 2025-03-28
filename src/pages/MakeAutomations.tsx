
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import AutomationList from '@/components/make/AutomationList';
import WebhookManager from '@/components/make/WebhookManager';
import EventMonitor from '@/components/make/EventMonitor';
import AutomationTestPanel from '@/components/make/AutomationTestPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMakeAutomations } from '@/hooks/useMakeAutomations';
import AutomationForm from '@/components/make/AutomationForm';
import { MakeAutomationRule } from '@/types/make';
import { PageContainer } from '@/components/Layout/PageContainer';

const MakeAutomations = () => {
  const [activeTab, setActiveTab] = useState('automations');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<MakeAutomationRule | null>(null);
  
  const { createAutomationRule } = useMakeAutomations();
  
  const handleCreateAutomation = () => {
    setCurrentRule(null);
    setIsDialogOpen(true);
  };
  
  const handleEditAutomation = (rule: MakeAutomationRule) => {
    setCurrentRule(rule);
    setIsDialogOpen(true);
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCurrentRule(null);
  };

  return (
    <PageContainer
      title="Make Automations"
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Make Automations', path: '/make-automations' }
      ]}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Make Automations</h2>
            <p className="text-muted-foreground">
              Create automation rules and webhooks to integrate with external systems.
            </p>
          </div>
          <Button onClick={handleCreateAutomation}>
            <Plus className="w-4 h-4 mr-2" />
            New Automation
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="automations">Automations</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="events">Event Log</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Automations</CardTitle>
                <CardDescription>
                  Manage automation rules that trigger actions based on events.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AutomationList onEditRule={handleEditAutomation} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Configurations</CardTitle>
                <CardDescription>
                  Configure webhooks to send data to external systems.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WebhookManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event History</CardTitle>
                <CardDescription>
                  View and monitor events processed by the automation system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventMonitor />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="test" className="space-y-6">
            <AutomationTestPanel />
          </TabsContent>
        </Tabs>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{currentRule ? 'Edit Automation' : 'Create Automation'}</DialogTitle>
            <DialogDescription>
              {currentRule 
                ? 'Modify the settings for this automation rule' 
                : 'Create a new automation rule to trigger actions based on events'
              }
            </DialogDescription>
          </DialogHeader>
          
          <AutomationForm rule={currentRule} onClose={handleCloseDialog} />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default MakeAutomations;
