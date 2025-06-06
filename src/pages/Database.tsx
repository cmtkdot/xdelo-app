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

const Database = () => {
  const [activeTab, setActiveTab] = useState("messages");
  const [isMobile, setIsMobile] = useState(false);
  
  // Use effect to detect mobile devices
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DatabaseIcon className="h-6 w-6 text-primary hidden sm:block" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Database Tables</h1>
        </div>
      </div>
      
      <Tabs defaultValue="messages" className="w-full">
        <div className="flex justify-end mb-4">
          <TabsList className="grid w-full sm:w-[400px] grid-cols-1 h-auto sm:h-10">
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="messages" className="m-0">
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
      </Tabs>
    </div>
  );
};

export default Database;
