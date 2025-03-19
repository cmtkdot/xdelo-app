
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

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

export const TestResultsDisplay = ({ result }: TestResultsDisplayProps) => {
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-muted-foreground">Run a test to see results here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Test Results
          {result.hasMatch ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Match Found
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <XCircle className="h-3 w-3 mr-1" /> No Match
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Message Content</div>
            <div className="p-3 bg-muted/30 rounded-md text-sm overflow-auto max-h-28">
              {result.message || "No content"}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium">Confidence</div>
              <div className="text-2xl font-bold">{Math.round(result.confidence * 100)}%</div>
            </div>
            <div>
              <div className="text-sm font-medium">Processing Time</div>
              <div className="text-2xl font-bold">{result.duration ? `${Math.round(result.duration)}ms` : "N/A"}</div>
            </div>
          </div>
          
          {result.hasMatch && result.matchedProduct && (
            <div className="space-y-2 pt-2">
              <div className="text-sm font-medium">Matched Product</div>
              <div className="p-3 bg-primary/5 rounded-md">
                <div className="font-medium">{result.matchedProduct.name}</div>
                <div className="text-xs text-muted-foreground mt-1">ID: {result.matchedProduct.id}</div>
              </div>
              
              <div className="text-sm font-medium mt-2">Matched Fields</div>
              <div className="flex flex-wrap gap-1">
                {result.matchedProduct.matchedFields.map((field) => (
                  <Badge key={field} variant="secondary" className="text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
