
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProcessingMessage } from "@/types/ProductMatching";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, XCircle, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BatchProcessingTableProps {
  messages: ProcessingMessage[];
  isLoading: boolean;
}

export const BatchProcessingTable: React.FC<BatchProcessingTableProps> = ({
  messages,
  isLoading
}) => {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground border rounded-md">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span>Loading messages...</span>
          </>
        ) : (
          <span>No messages to display</span>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead>Product Info</TableHead>
            <TableHead>Vendor / Date</TableHead>
            <TableHead className="w-[100px]">Confidence</TableHead>
            <TableHead className="w-[200px]">Match Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                <Badge
                  variant={
                    message.status === 'matched' ? 'default' :
                    message.status === 'unmatched' ? 'secondary' :
                    message.status === 'error' ? 'destructive' :
                    'outline'
                  }
                  className="whitespace-nowrap"
                >
                  {message.status === 'processing' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {message.status === 'matched' && <Check className="mr-1 h-3 w-3" />}
                  {message.status === 'unmatched' && <AlertTriangle className="mr-1 h-3 w-3" />}
                  {message.status === 'error' && <XCircle className="mr-1 h-3 w-3" />}
                  {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="font-medium truncate max-w-[200px]">
                  {message.productName || 'No product name'}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {message.vendorUid ? (
                    <div className="text-xs font-medium">Vendor: {message.vendorUid}</div>
                  ) : null}
                  {message.purchaseDate ? (
                    <div className="text-xs text-muted-foreground">Date: {message.purchaseDate}</div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {message.status === 'matched' && message.matchConfidence !== undefined ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {Math.round(message.matchConfidence * 100)}%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Match confidence score</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : message.status === 'processing' ? (
                  <span className="text-muted-foreground text-xs">Calculating...</span>
                ) : message.status === 'error' ? (
                  <span className="text-destructive text-xs">Failed</span>
                ) : (
                  <span className="text-muted-foreground text-xs">No match</span>
                )}
              </TableCell>
              <TableCell>
                {message.status === 'matched' && message.matchedProductName ? (
                  <div className="text-sm font-medium truncate max-w-[180px]">{message.matchedProductName}</div>
                ) : message.status === 'error' ? (
                  <div className="text-destructive text-xs">{message.errorMessage || 'Processing error'}</div>
                ) : message.status === 'processing' ? (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No match found</div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
