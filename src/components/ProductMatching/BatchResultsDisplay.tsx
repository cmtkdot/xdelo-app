
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

interface BatchResults {
  total: number;
  matched: number;
  unmatched: number;
  failed: number;
  averageConfidence: number;
  topMatches: {
    messageId: string;
    productName: string;
    confidence: number;
  }[];
}

interface BatchResultsDisplayProps {
  results: BatchResults | null;
}

export const BatchResultsDisplay: React.FC<BatchResultsDisplayProps> = ({ results }) => {
  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Results</CardTitle>
          <CardDescription>
            Run a batch match to see results
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px] text-center text-muted-foreground">
          <BarChart className="h-12 w-12 mb-2 text-muted-foreground/50" />
          <p>No results to display yet</p>
          <p className="text-sm mt-1">Batch match results will appear here</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate percentages
  const matchedPercent = results.total > 0 ? Math.round((results.matched / results.total) * 100) : 0;
  const unmatchedPercent = results.total > 0 ? Math.round((results.unmatched / results.total) * 100) : 0;
  const failedPercent = results.total > 0 ? Math.round((results.failed / results.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Results</CardTitle>
        <CardDescription>
          Processed {results.total} messages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                <span>Matched</span>
              </div>
              <div className="flex items-center">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {results.matched} of {results.total}
                </Badge>
                <span className="ml-2 text-sm">{matchedPercent}%</span>
              </div>
            </div>
            <Progress value={matchedPercent} className="h-2 bg-gray-100" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <HelpCircle className="mr-2 h-4 w-4 text-amber-500" />
                <span>Unmatched</span>
              </div>
              <div className="flex items-center">
                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                  {results.unmatched} of {results.total}
                </Badge>
                <span className="ml-2 text-sm">{unmatchedPercent}%</span>
              </div>
            </div>
            <Progress value={unmatchedPercent} className="h-2 bg-gray-100" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
                <span>Failed</span>
              </div>
              <div className="flex items-center">
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  {results.failed} of {results.total}
                </Badge>
                <span className="ml-2 text-sm">{failedPercent}%</span>
              </div>
            </div>
            <Progress value={failedPercent} className="h-2 bg-gray-100" />
          </div>

          {results.matched > 0 && (
            <>
              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium mb-3">Average Match Confidence</h4>
                <div className="flex items-center">
                  <Progress 
                    value={results.averageConfidence * 100} 
                    className="h-2 bg-gray-100 flex-1" 
                  />
                  <span className="ml-2 text-sm font-medium">
                    {Math.round(results.averageConfidence * 100)}%
                  </span>
                </div>
              </div>

              {results.topMatches && results.topMatches.length > 0 && (
                <div className="pt-2 border-t">
                  <h4 className="text-sm font-medium mb-3">Top Matches</h4>
                  <div className="space-y-2">
                    {results.topMatches.map((match, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="truncate max-w-[70%]">{match.productName}</div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {Math.round(match.confidence * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
