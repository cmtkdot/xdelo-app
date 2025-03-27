
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelegramSettingsTab } from "./TelegramSettingsTab";
import { MessageRecoveryTools } from "./MessageRecoveryTools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="telegram">
        <TabsList className="mb-6">
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="telegram">
          <TelegramSettingsTab />
        </TabsContent>
        
        <TabsContent value="maintenance">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Maintenance Tools</CardTitle>
              <CardDescription>
                Tools for system maintenance and error recovery
              </CardDescription>
            </CardHeader>
          </Card>
          
          <MessageRecoveryTools />
        </TabsContent>
      </Tabs>
    </div>
  );
}
