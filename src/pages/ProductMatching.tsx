import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BatchMatchingPanel } from '@/components/ProductMatching/BatchMatchingPanel';
import { TestMatchingPanel } from '@/components/ProductMatching/TestMatchingPanel';
import { MatchingConfiguration } from '@/components/ProductMatching/MatchingConfiguration';
import { MatchingHistory } from '@/components/ProductMatching/MatchingHistory';
import { useProductMatching } from '@/hooks/useProductMatching';

const ProductMatching = () => {
  const [activeTab, setActiveTab] = useState('test');
  const productMatching = useProductMatching();
  
  // Clear results when changing tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    productMatching.clearResults();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Product Matching</h1>
        <p className="text-muted-foreground mt-2">
          Test and manage product matching functionality
        </p>
      </div>

      <Tabs 
        defaultValue="test" 
        value={activeTab} 
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="test">Test Matching</TabsTrigger>
          <TabsTrigger value="batch">Batch Process</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Product Matching</CardTitle>
              <CardDescription>
                Test the product matching system with individual messages or custom text
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TestMatchingPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Processing</CardTitle>
              <CardDescription>
                Process multiple messages and match them to products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BatchMatchingPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Matching History</CardTitle>
              <CardDescription>
                View previous matching operations and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatchingHistory />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Adjust product matching settings and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatchingConfiguration />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductMatching;
