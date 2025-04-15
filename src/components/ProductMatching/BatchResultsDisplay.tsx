
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchResults } from "@/types/ProductMatching";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface BatchResultsDisplayProps {
  results: BatchResults | null;
}

export const BatchResultsDisplay: React.FC<BatchResultsDisplayProps> = ({ results }) => {
  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Results</CardTitle>
          <CardDescription>Run a batch match to see results here</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40 text-muted-foreground">
          <Info className="mr-2 h-5 w-5" />
          <span>No batch processing data yet</span>
        </CardContent>
      </Card>
    );
  }

  const { total, matched, unmatched, failed, averageConfidence, topMatches } = results;
  const matchedPercentage = total > 0 ? Math.round((matched / total) * 100) : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Results</CardTitle>
        <CardDescription>
          Processed {total} message{total !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{matchedPercentage}%</p>
              <p className="text-muted-foreground text-sm">Match rate</p>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="space-y-1">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-full">
                  <CheckCircle className="mr-1 h-3 w-3" /> {matched}
                </Badge>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
              
              <div className="space-y-1">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 w-full">
                  <AlertTriangle className="mr-1 h-3 w-3" /> {unmatched}
                </Badge>
                <p className="text-xs text-muted-foreground">Unmatched</p>
              </div>
              
              <div className="space-y-1">
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 w-full">
                  <XCircle className="mr-1 h-3 w-3" /> {failed}
                </Badge>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
          
          {averageConfidence !== undefined && (
            <div>
              <p className="text-sm font-medium mb-1">Average Confidence</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${Math.round(averageConfidence * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(averageConfidence * 100)}% confidence across matches
              </p>
            </div>
          )}
          
          {topMatches && topMatches.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Top Matches</p>
              <ul className="space-y-2">
                {topMatches.map((match, index) => (
                  <li key={index} className="text-sm border rounded-md p-2 flex justify-between">
                    <span className="truncate max-w-[70%]">{match.productName}</span>
                    <Badge variant="secondary">
                      {Math.round(match.confidence * 100)}%
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
