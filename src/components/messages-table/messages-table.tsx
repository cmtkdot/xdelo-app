import { type Message } from "@/types/Message";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MediaViewer } from "@/components/media-viewer/media-viewer";
import { useState } from "react";
import { format } from "date-fns";
import { Eye, Pencil, Trash2 } from "lucide-react";

interface MessagesTableProps {
  messages: Message[];
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}

export const MessagesTable = ({
  messages,
  onEdit,
  onDelete,
}: MessagesTableProps) => {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleView = (message: Message) => {
    setSelectedMessage(message);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setSelectedMessage(null);
  };

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left font-medium">Preview</th>
                <th className="p-4 text-left font-medium">Caption</th>
                <th className="p-4 text-left font-medium">Created</th>
                <th className="p-4 text-left font-medium">Analysis</th>
                <th className="p-4 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id} className="border-b last:border-0">
                  <td className="p-4">
                    {message.public_url ? (
                      <div className="w-16 h-16 relative">
                        <img
                          src={message.public_url}
                          alt={message.caption || 'Message preview'}
                          className="w-full h-full object-cover rounded-md"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">No preview</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="max-w-xs truncate">
                      {message.caption || 'No caption'}
                    </div>
                  </td>
                  <td className="p-4">
                    {format(new Date(message.created_at), 'PPP')}
                  </td>
                  <td className="p-4">
                    <div className="max-w-xs truncate">
                      {message.analyzed_content ? (
                        Object.entries(message.analyzed_content)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(', ')
                      ) : (
                        'No analysis'
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(message)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(message)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(message)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <MediaViewer
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
        media={selectedMessage}
      />
    </>
  );
};
