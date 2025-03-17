
import { Tag, Package, CalendarIcon, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnalyzedContent } from "@/types/utils/AnalyzedContent";
import { formatDate } from "@/lib/generalUtils";

interface CompactContentDisplayProps {
  content?: AnalyzedContent;
}

export const CompactContentDisplay = ({ content }: CompactContentDisplayProps) => {
  if (!content) return null;

  // Format date if it exists
  const formattedDate = content.purchase_date ? formatDate(new Date(content.purchase_date)) : null;

  return (
    <div className="space-y-2">
      {/* Top row with vendor and product code */}
      {(content.vendor_uid || content.product_code) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {content.vendor_uid && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Tag className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{content.vendor_uid}</span>
            </div>
          )}
          
          {content.product_code && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Package className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{content.product_code}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Middle row with date and quantity */}
      <div className="flex items-center justify-between gap-2">
        {formattedDate && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <CalendarIcon className="h-3 w-3 flex-shrink-0" />
            <span>{formattedDate}</span>
          </div>
        )}
        
        {content.quantity && (
          <Badge variant="outline" className="text-xs font-medium ml-auto">
            Qty: {content.quantity}
          </Badge>
        )}
      </div>
      
      {/* Notes (conditionally shown) */}
      {content.notes && (
        <div className="text-muted-foreground text-xs">
          <div className="flex gap-1.5 items-start">
            <FileText className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <p className="line-clamp-2">{content.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
};
