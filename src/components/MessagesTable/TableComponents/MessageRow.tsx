
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Save, X, Trash2 } from "lucide-react";
import { Message, AnalyzedContent } from "@/types";

interface MessageRowProps {
  message: Message;
  isEditing: boolean;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
  onSave: (id: string) => void;
  onDelete: (message: Message) => void;
  onCaptionChange: (id: string, value: string) => void;
  onAnalyzedContentChange: (id: string, field: keyof AnalyzedContent, value: string | number) => void;
  onMediaClick: (message: Message) => void;
  isProcessing: boolean;
}

export const MessageRow: React.FC<MessageRowProps> = ({
  message,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onCaptionChange,
  onAnalyzedContentChange,
  onMediaClick,
  isProcessing
}) => {
  const renderMediaPreview = () => {
    if (!message.public_url) return null;

    if (message.mime_type?.startsWith('video/')) {
      return (
        <div className="relative w-16 h-16 cursor-pointer" onClick={() => onMediaClick(message)}>
          <video src={message.public_url} className="w-16 h-16 object-cover rounded-md" />
        </div>
      );
    }

    return (
      <img 
        src={message.public_url} 
        alt={message.caption || 'Preview'} 
        className="w-16 h-16 object-cover rounded-md cursor-pointer"
        onClick={() => onMediaClick(message)}
      />
    );
  };

  return (
    <TableRow>
      <TableCell>{renderMediaPreview()}</TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            value={message.analyzed_content?.product_name || ''}
            onChange={(e) => onAnalyzedContentChange(message.id, 'product_name', e.target.value)}
          />
        ) : (
          message.analyzed_content?.product_name || '-'
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            value={message.analyzed_content?.vendor_uid || ''}
            onChange={(e) => onAnalyzedContentChange(message.id, 'vendor_uid', e.target.value)}
          />
        ) : (
          message.analyzed_content?.vendor_uid || '-'
        )}
      </TableCell>
      <TableCell>
        {message.analyzed_content?.purchase_date ? 
          new Date(message.analyzed_content.purchase_date).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
          }) : 
          '-'}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            type="number"
            value={message.analyzed_content?.quantity || ''}
            onChange={(e) => onAnalyzedContentChange(message.id, 'quantity', parseFloat(e.target.value))}
          />
        ) : (
          message.analyzed_content?.quantity || '-'
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            value={message.analyzed_content?.notes || ''}
            onChange={(e) => onAnalyzedContentChange(message.id, 'notes', e.target.value)}
          />
        ) : (
          message.analyzed_content?.notes || '-'
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            value={message.caption || ''}
            onChange={(e) => onCaptionChange(message.id, e.target.value)}
          />
        ) : (
          message.caption || '-'
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSave(message.id)}
                disabled={isProcessing}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCancel(message.id)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(message.id)}
                disabled={isProcessing}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(message)}
                disabled={isProcessing}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};
