
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, HelpCircle } from "lucide-react";

interface TestResult {
  messageId: string;
  message: string;
  hasMatch: boolean;
  confidence: number;
  matchedProduct?: {
    id: string;
    name: string;
    matchedFields: string[];
  };
  duration?: number;
}

interface TestResultsDisplayProps {
  result: TestResult | null;
}

export const TestResultsDisplay: React.FC<TestResultsDisplayProps> = ({ result }) => {
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>
            Run a test match to see results
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mb-2 text-muted-foreground/50" />
          <p>No test results to display yet</p>
          <p className="text-sm mt-1">Test match results will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Match results for selected message
            </CardDescription>
          </div>
          {result.hasMatch ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 flex items-center">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Match Found
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 flex items-center">
              <HelpCircle className="h-3 w-3 mr-1" />
              No Match
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-2">Message Content</h4>
            <div className="rounded-md border p-3 bg-muted/20 whitespace-pre-wrap text-sm">
              {result.message || "No message content"}
            </div>
          </div>

          {result.duration && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-2" />
              Processed in {result.duration < 1000 ? `${result.duration}ms` : `${(result.duration / 1000).toFixed(2)}s`}
            </div>
          )}

          {result.hasMatch && result.matchedProduct && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-2">Matched Product</h4>
                <div className="rounded-md border p-3">
                  <div className="font-medium">{result.matchedProduct.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Product ID: {result.matchedProduct.id}
                  </div>
                  <div className="flex items-center mt-3">
                    <div className="text-sm mr-2">Confidence:</div>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      {Math.round(result.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Match Criteria</h4>
                <div className="flex flex-wrap gap-2">
                  {result.matchedProduct.matchedFields.map((field, idx) => (
                    <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700">
                      {field.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {!result.hasMatch && (
            <div className="rounded-md border p-4 bg-amber-50 text-amber-800">
              <h4 className="font-medium mb-1">No Product Match Found</h4>
              <p className="text-sm">
                The product matching algorithm could not find a suitable match for this message.
                You may want to check the message content or try adjusting the matching configuration.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
