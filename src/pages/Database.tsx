import React, { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatabaseTable } from "@/components/Database/DatabaseTable";
import { Database as DatabaseIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

const Database = () => {
  const [activeTab, setActiveTab] = useState("messages");
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DatabaseIcon className="h-6 w-6 text-primary hidden sm:block" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Database Tables</h1>
        </div>
        <div className="w-full sm:w-auto">
          <Tabs defaultValue="messages" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-1 h-auto sm:h-10 sm:w-[400px]">
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <TabsContent value="messages" className="m-0" forceMount={activeTab === "messages"}>
        <Card className="w-full border-0 sm:border">
          <CardHeader className="px-2 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-lg sm:text-xl">Messages Table</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              View and manage Telegram media messages from your database
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <DatabaseTable />
          </CardContent>
        </Card>
      </TabsContent>
    </div>
  );
};

export default Database;
