
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";

export const ProductRecommendationCard: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Matching Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Best Format for Product Codes
          </h3>
          <p className="text-sm text-muted-foreground">
            Use the format <span className="font-mono">#VENDOR00000</span> where VENDOR is 
            the vendor code (1-4 letters) and the numbers represent the MMDDYY purchase date.
          </p>
        </div>
        
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Product Names
          </h3>
          <p className="text-sm text-muted-foreground">
            Keep product names consistent between your caption and inventory. The algorithm uses 
            fuzzy matching, but better matches happen with more consistent naming.
          </p>
        </div>
        
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Include Quantities
          </h3>
          <p className="text-sm text-muted-foreground">
            Adding quantities with <span className="font-mono">x 5</span> or <span className="font-mono">5x</span> format
            helps with automated inventory tracking.
          </p>
        </div>
        
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Matching Thresholds
          </h3>
          <p className="text-sm text-muted-foreground">
            The default confidence threshold is 60%. Matches below 75% require manual approval, 
            while higher confidence matches are automatically approved.
          </p>
        </div>
        
        <div className="bg-blue-50 rounded-md p-3 mt-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-1 text-blue-700">
            Recommended Caption Format
          </h3>
          <pre className="text-xs bg-white p-2 rounded border border-blue-100 text-blue-800 whitespace-pre-wrap">
            Product Name #VENDOR123456 x 5
            (additional notes)
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};
