
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, CheckCircle, XCircle, AlertCircle } from "lucide-react";

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

export const BatchResultsDisplay = ({ results }: BatchResultsDisplayProps) => {
  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Batch Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-muted-foreground">Run a batch operation to see results here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const matchRate = results.total > 0 ? (results.matched / results.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Batch Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Match Rate</div>
              <div className="text-2xl font-bold">
                {matchRate.toFixed(1)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Avg. Confidence</div>
              <div className="text-2xl font-bold">
                {(results.averageConfidence * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md p-2 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Matched</span>
              </div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">
                {results.matched}
              </div>
            </div>
            
            <div className="rounded-md p-2 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Unmatched</span>
              </div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {results.unmatched}
              </div>
            </div>
            
            <div className="rounded-md p-2 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Failed</span>
              </div>
              <div className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">
                {results.failed}
              </div>
            </div>
          </div>
          
          {results.topMatches.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Top Matches</div>
              <div className="space-y-2">
                {results.topMatches.map((match, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
                    <div className="text-sm truncate max-w-[200px]">{match.productName}</div>
                    <div className="text-sm font-medium">{(match.confidence * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
