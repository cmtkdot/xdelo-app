
import React from 'react';
import { Message } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { MediaThumbnail } from './MediaThumbnail';

interface GalleryTableViewProps {
  messages: Message[];
  onMediaClick: (message: Message) => void;
  onDeleteMessage?: (id: string) => Promise<void>;
}

export function GalleryTableView({ messages, onMediaClick, onDeleteMessage }: GalleryTableViewProps) {
  const handleDeleteClick = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (onDeleteMessage) {
      await onDeleteMessage(id);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Media</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((message) => {
            const productName = message.analyzed_content?.product_name || message.caption || 'Unknown';
            const vendorName = message.vendor_uid || message.analyzed_content?.vendor_uid || 'Unknown';
            const dateString = message.created_at 
              ? format(new Date(message.created_at), 'MMM d, yyyy')
              : 'Unknown date';

            return (
              <TableRow 
                key={message.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onMediaClick(message)}
              >
                <TableCell>
                  <MediaThumbnail message={message} />
                </TableCell>
                <TableCell className="font-medium">
                  {productName}
                </TableCell>
                <TableCell>{vendorName}</TableCell>
                <TableCell>{dateString}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMediaClick(message);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onDeleteMessage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteClick(e, message.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
