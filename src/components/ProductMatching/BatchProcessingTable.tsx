
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface BatchProcessingMessage {
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
  messages: BatchProcessingMessage[];
  isLoading?: boolean;
}

export const BatchProcessingTable: React.FC<BatchProcessingTableProps> = ({ 
  messages, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading messages...</span>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="text-center p-6 bg-muted/20 rounded-md">
        <p className="text-muted-foreground">No messages have been processed yet</p>
      </div>
    );
  }

  const getStatusBadge = (status: string, confidence?: number) => {
    switch (status) {
      case 'processing':
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
          </Badge>
        );
      case 'matched':
        return (
          <Badge variant="outline" className={confidence && confidence >= 0.75 
            ? "bg-green-100 text-green-800 border-green-200" 
            : "bg-amber-100 text-amber-800 border-amber-200"
          }>
            <CheckCircle className="h-3 w-3 mr-1" /> 
            {confidence ? `Matched (${Math.round(confidence * 100)}%)` : 'Matched'}
          </Badge>
        );
      case 'unmatched':
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
            <AlertCircle className="h-3 w-3 mr-1" /> No Match
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" /> Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">{status}</Badge>
        );
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM d, yyyy HH:mm:ss');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Message Info</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Match Result</TableHead>
            <TableHead className="hidden md:table-cell">Timing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium truncate max-w-[200px]">
                    {message.productName || 'Unknown Product'}
                  </div>
                  {message.vendorUid && (
                    <div className="text-xs text-muted-foreground">
                      Vendor: {message.vendorUid}
                    </div>
                  )}
                  {message.purchaseDate && (
                    <div className="text-xs text-muted-foreground">
                      Date: {message.purchaseDate}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {getStatusBadge(message.status, message.matchConfidence)}
                {message.errorMessage && (
                  <div className="text-xs text-red-600 mt-1 max-w-[200px] truncate">
                    {message.errorMessage}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {message.matchedProductName ? (
                  <div className="space-y-1">
                    <div className="font-medium truncate max-w-[200px]">
                      {message.matchedProductName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {message.matchedProductId}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">No product matched</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {message.processingStartedAt && (
                  <div className="text-xs">
                    Started: {formatDate(message.processingStartedAt)}
                  </div>
                )}
                {message.processingCompletedAt && (
                  <div className="text-xs">
                    Completed: {formatDate(message.processingCompletedAt)}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
