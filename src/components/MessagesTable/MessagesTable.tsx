
import { useState } from "react";
import { type Message } from "@/types";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface MessagesTableProps {
  messages: Message[];
}

export function MessagesTable({ messages }: MessagesTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Message;
    direction: 'asc' | 'desc';
  }>({ key: 'created_at', direction: 'desc' });

  const sortedMessages = [...messages].sort((a, b) => {
    if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;
    
    const compareResult = String(a[sortConfig.key]).localeCompare(String(b[sortConfig.key]));
    return sortConfig.direction === 'asc' ? compareResult : -compareResult;
  });

  const handleSort = (key: keyof Message) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead onClick={() => handleSort('created_at')} className="cursor-pointer">
              Date
            </TableHead>
            <TableHead onClick={() => handleSort('caption')} className="cursor-pointer">
              Caption
            </TableHead>
            <TableHead>Media Type</TableHead>
            <TableHead onClick={() => handleSort('processing_state')} className="cursor-pointer">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMessages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                {message.created_at ? format(new Date(message.created_at), 'PPP') : 'N/A'}
              </TableCell>
              <TableCell>{message.caption || 'No caption'}</TableCell>
              <TableCell>{message.media_type || 'Unknown'}</TableCell>
              <TableCell>{message.processing_state}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
