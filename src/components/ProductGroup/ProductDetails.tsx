
import { MediaItem } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { getAnalyzedContent } from "./utils";

interface ProductDetailsProps {
  group: MediaItem[];
  hasError: boolean;
  errorMessage?: string;
}

export const ProductDetails = ({ group, hasError, errorMessage }: ProductDetailsProps) => {
  const analyzedContent = getAnalyzedContent(group);

  return (
    <div className="space-y-2">
      <div className="space-y-1 text-xs text-gray-600">
        {analyzedContent?.product_code && (
          <p>PO#: {analyzedContent.product_code}</p>
        )}
        {analyzedContent?.vendor_uid && (
          <p>Vendor: {analyzedContent.vendor_uid}</p>
        )}
      </div>

      {analyzedContent?.parsing_metadata?.confidence < 0.7 && (
        <p className="text-xs text-yellow-600">
          Low confidence analysis ({Math.round(analyzedContent.parsing_metadata.confidence * 100)}%)
        </p>
      )}
      
      {hasError && (
        <Alert variant="destructive" className="mt-2 p-2 text-xs">
          <AlertDescription>
            {errorMessage || 'Processing error occurred'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

