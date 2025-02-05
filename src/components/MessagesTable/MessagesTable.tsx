
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Save, X, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Database } from "@/types";

type Message = Database['public']['Tables']['messages']['Row'];

interface EditableMessage extends Message {
  isEditing?: boolean;
}

interface MessagesTableProps {
  messages: Message[];
}

export const MessagesTable: React.FC<MessagesTableProps> = ({ messages: initialMessages }) => {
  const [messages, setMessages] = useState<EditableMessage[]>(initialMessages);
  const { toast } = useToast();

  const handleEdit = (id: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...message, isEditing: true }
          : message
      )
    );
  };

  const handleCancel = (id: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...initialMessages.find(m => m.id === id)!, isEditing: false }
          : message
      )
    );
  };

  const handleSave = async (id: string) => {
    const message = messages.find(m => m.id === id);
    if (!message) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          caption: message.caption,
          product_name: message.product_name,
          vendor_name: message.vendor_name,
          product_quantity: message.product_quantity,
        })
        .eq('id', id);

      if (error) throw error;

      setMessages(prev =>
        prev.map(m =>
          m.id === id
            ? { ...m, isEditing: false }
            : m
        )
      );

      toast({
        title: "Success",
        description: "Message updated successfully",
      });
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== id));
      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const handleChange = (id: string, field: keyof Message, value: string | number) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...message, [field]: value }
          : message
      )
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created At</TableHead>
            <TableHead>Caption</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                {message.created_at ? format(new Date(message.created_at), 'MM/dd/yyyy HH:mm') : '-'}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.caption || ''}
                    onChange={(e) => handleChange(message.id, 'caption', e.target.value)}
                  />
                ) : (
                  message.caption || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.product_name || ''}
                    onChange={(e) => handleChange(message.id, 'product_name', e.target.value)}
                  />
                ) : (
                  message.product_name || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.vendor_name || ''}
                    onChange={(e) => handleChange(message.id, 'vendor_name', e.target.value)}
                  />
                ) : (
                  message.vendor_name || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    type="number"
                    value={message.product_quantity || ''}
                    onChange={(e) => handleChange(message.id, 'product_quantity', parseFloat(e.target.value))}
                  />
                ) : (
                  message.product_quantity || '-'
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {message.isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSave(message.id)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancel(message.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(message.id)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(message.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
