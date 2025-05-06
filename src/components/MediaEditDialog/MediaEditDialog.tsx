import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMediaUtils } from "@/hooks/useMediaUtils";
import { useToast } from "@/hooks/useToast";
import { Message } from "@/types/entities/Message";
import { useEffect, useState } from "react";

// Define a minimal message type with only the properties needed for editing
interface EditableMessage extends Partial<Message> {
  id: string;
  caption?: string;
  media_group_id?: string;
}

interface MediaEditDialogProps {
  isOpen?: boolean;
  open?: boolean; // Support both naming conventions
  media: EditableMessage;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void; // Support both callback patterns
  onSave?: (newCaption: string) => void;
  refresh?: () => void;
}

export function MediaEditDialog({
  isOpen,
  open,
  media,
  onClose,
  onOpenChange,
  onSave,
  refresh,
}: MediaEditDialogProps) {
  // Use either isOpen or open prop
  const isDialogOpen = isOpen !== undefined ? isOpen : open;

  const [newCaption, setNewCaption] = useState(media?.caption || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { syncMessageCaption } = useMediaUtils();
  const { toast } = useToast();

  useEffect(() => {
    if (media) {
      setNewCaption(media.caption || "");
    }
  }, [media]);

  const handleSave = async () => {
    if (!media) return;

    try {
      setIsSaving(true);
      setError(null);

      // Check if caption changed
      if (newCaption !== media.caption) {
        // Call the API to update the caption
        const success = await syncMessageCaption(media.id, newCaption);

        if (!success) {
          const errorMessage = "Failed to update caption";
          setError(errorMessage);
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Caption updated successfully",
        });

        if (onSave) {
          onSave(newCaption);
        }

        if (onClose) {
          onClose();
        } else if (onOpenChange) {
          onOpenChange(false);
        }

        if (refresh) {
          refresh();
        }
      } else {
        // If nothing changed, just close
        if (onClose) {
          onClose();
        } else if (onOpenChange) {
          onOpenChange(false);
        }
      }
    } catch (error) {
      console.error("Error saving media:", error);
      setError("An unexpected error occurred");
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (onOpenChange) {
          onOpenChange(open);
        } else if (!open && onClose) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
        </DialogHeader>

        {media && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <label htmlFor="caption" className="text-sm font-medium">
                Caption
              </label>
              <Textarea
                id="caption"
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                className="col-span-3"
                rows={5}
              />
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (onClose) {
                onClose();
              } else if (onOpenChange) {
                onOpenChange(false);
              }
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Spinner className="mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
