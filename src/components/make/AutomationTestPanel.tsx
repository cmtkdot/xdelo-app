import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MakeEventType, MakeAutomationRule } from '@/types/make';

interface AutomationTestPanelProps {
  rule: MakeAutomationRule;
  onTest: (data: any) => void;
}

const getExampleData = (eventType: string) => {
  switch (eventType) {
    case MakeEventType.MESSAGE_RECEIVED:
      return {
        caption: "Sample product ABC12345",
        chat_title: "Test Channel",
        media_group_id: "group123",
        file_size: 1024,
        mime_type: "image/jpeg"
      };
    default:
      return {};
  }
};

const formSchema = z.object({
  caption: z.string().optional(),
  chat_title: z.string().optional(),
  media_group_id: z.string().optional(),
  file_size: z.string().optional(),
  mime_type: z.string().optional(),
})

export function AutomationTestPanel({ rule, onTest }: AutomationTestPanelProps) {
  const [testValues, setTestValues] = useState({});

  // Form instance
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caption: "",
      chat_title: "",
      media_group_id: "",
      file_size: "",
      mime_type: "",
    },
  })

  // Generate test data for simulation
  const generateTestData = () => {
    const baseData = getExampleData(rule.event_type);
    
    // For manual testing, add all custom values
    const customData = { ...baseData };
    Object.keys(testValues).forEach(key => {
      if (testValues[key]) {
        customData[key] = testValues[key];
      }
    });
    
    return customData;
  };

  // Handle test button click
  const handleTest = () => {
    const testData = generateTestData();
    onTest(testData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Automation Rule</CardTitle>
        <CardDescription>
          Simulate the automation rule with custom data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleTest)} className="space-y-4">
            {rule.event_type === MakeEventType.MESSAGE_RECEIVED && (
              // Message received specific fields
              <div className="space-y-4">
                <FormField
                  name="testValues.caption"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caption</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Product ABC12345" />
                      </FormControl>
                      <FormDescription>
                        Text content of the message
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="testValues.chat_title"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chat Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Test Channel" />
                      </FormControl>
                      <FormDescription>
                        Title of the chat
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="testValues.media_group_id"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Media Group ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="group123" />
                      </FormControl>
                      <FormDescription>
                        ID of the media group
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="testValues.file_size"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File Size</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="1024" type="number" />
                      </FormControl>
                      <FormDescription>
                        Size of the file in bytes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="testValues.mime_type"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MIME Type</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="image/jpeg" />
                      </FormControl>
                      <FormDescription>
                        MIME type of the file
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Button type="button" onClick={handleTest}>
              Test Rule
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
