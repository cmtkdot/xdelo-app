
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileCheck, RefreshCw } from 'lucide-react';
import { useMediaUtils } from '@/hooks/useMediaUtils/useMediaUtils';
import ResetStuckMessages from './ResetStuckMessages';

export function SystemRepairPanel() {
  const { repairMediaBatch, isProcessing, standardizeStoragePaths } = useMediaUtils();

  return (
    <Tabs defaultValue="messages">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="messages">Message Processing</TabsTrigger>
        <TabsTrigger value="media">Media Repair</TabsTrigger>
      </TabsList>
      
      <TabsContent value="messages" className="mt-4">
        <ResetStuckMessages />
      </TabsContent>
      
      <TabsContent value="media" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Media Repair Tools</CardTitle>
            <CardDescription>
              Repair media files and storage paths
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="border border-muted">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Repair Media Files</CardTitle>
                  <CardDescription>
                    Find and repair missing or corrupted media files
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Button
                    onClick={() => repairMediaBatch()}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Repairing...
                      </>
                    ) : (
                      <>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Repair Media
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="border border-muted">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Standardize Storage Paths</CardTitle>
                  <CardDescription>
                    Fix incorrect or non-standard storage paths
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Button
                    onClick={() => standardizeStoragePaths()}
                    disabled={isProcessing}
                    className="w-full"
                    variant="secondary"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Standardizing...
                      </>
                    ) : (
                      <>
                        <FileCheck className="mr-2 h-4 w-4" />
                        Fix Paths
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
