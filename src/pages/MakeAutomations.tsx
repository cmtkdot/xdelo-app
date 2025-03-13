import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="min-h-screen flex flex-col px-6 py-8 md:py-12 max-w-7xl mx-auto">
      
      <main className="flex-1 flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Make Automations</h1>
          <Button onClick={handleCreateAutomation}>
            <Plus className="w-4 h-4 mr-2" />
            New Automation
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="automations">Automations</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="events">Event Log</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Automations</CardTitle>
              </CardHeader>
              <CardContent>
                <AutomationList onEditRule={handleEditAutomation} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Configurations</CardTitle>
              </CardHeader>
              <CardContent>
                <WebhookManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Event History</CardTitle>
              </CardHeader>
              <CardContent>
                <EventMonitor />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="test" className="space-y-4">
            <AutomationTestPanel />
          </TabsContent>
        </Tabs>
      </main>
      
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
      
      <footer className="mt-auto pt-12 pb-6 text-center text-sm text-muted-foreground">
        <p>Telegram Media Harvester &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default MakeAutomations; 