
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

// Define the interface for the processed messages
interface ProcessingMessage {
  id: string;
  productName?: string;
  vendorUid?: string;
  purchaseDate?: string;
  status: 'processing' | 'matched' | 'unmatched' | 'error';
  matchConfidence?: number;
  matchedProductId?: string;
  matchedProductName?: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  errorMessage?: string;
}

interface BatchProcessingTableProps {
  messages: ProcessingMessage[];
  isLoading?: boolean;
}

export const BatchProcessingTable: React.FC<BatchProcessingTableProps> = ({
  messages,
  isLoading = false,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>;
      case 'matched':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Matched
        </Badge>;
      case 'unmatched':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          No Match
        </Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format time duration for processing
  const getProcessingDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return "N/A";
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    
    // Calculate the difference in milliseconds
    const durationMs = end.getTime() - start.getTime();
    
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    } else if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(1)}s`;
    } else {
      return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Info</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Match Result</TableHead>
            <TableHead className="text-right">Processing Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && messages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Processing batch requests...</p>
              </TableCell>
            </TableRow>
          ) : messages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                <p className="text-sm text-muted-foreground">No messages to display</p>
              </TableCell>
            </TableRow>
          ) : (
            messages.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  <div className="font-medium truncate max-w-[200px]">
                    {message.productName || "Unnamed Product"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {message.vendorUid && (
                      <span className="mr-2">Vendor: {message.vendorUid}</span>
                    )}
                    {message.purchaseDate && (
                      <span>Date: {message.purchaseDate}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(message.status)}
                </TableCell>
                <TableCell>
                  {message.status === 'matched' ? (
                    <div>
                      <div className="font-medium truncate max-w-[200px]">
                        {message.matchedProductName || "Unknown Product"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Confidence: {Math.round((message.matchConfidence || 0) * 100)}%
                      </div>
                    </div>
                  ) : message.status === 'error' ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-red-600 text-sm truncate max-w-[200px]">
                            {message.errorMessage || "Unknown error"}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{message.errorMessage}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : message.status === 'unmatched' ? (
                    <div className="text-sm text-muted-foreground">
                      No suitable match found
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Awaiting results...
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div>
                    {message.processingCompletedAt ? (
                      <span className="text-sm">
                        {getProcessingDuration(message.processingStartedAt, message.processingCompletedAt)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {getProcessingDuration(message.processingStartedAt)} so far
                      </span>
                    )}
                  </div>
                  {message.processingStartedAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Started {formatDistanceToNow(new Date(message.processingStartedAt), { addSuffix: true })}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
