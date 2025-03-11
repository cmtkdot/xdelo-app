
import { useState } from "react";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { Message } from "@/types";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ProductGroupProps {
  group: Message[];
  onEdit: (media: Message) => void;
  onDelete: (media: Message, deleteTelegram: boolean) => Promise<void>;
  onView: (group: Message[]) => void;
  isDeleting?: boolean;
}

export function ProductGroup({ group, onEdit, onDelete, onView, isDeleting }: ProductGroupProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTelegram, setDeleteTelegram] = useState(false);
  const [isDeleting_, setIsDeleting_] = useState(false);

  if (!group || group.length === 0) return null;

  const mainMedia = group.find((m) => m.caption) || group[0];
  if (!mainMedia) return null;

  const handleDeleteClick = async (deleteTelegram: boolean) => {
    try {
      setIsDeleting_(true);
      await onDelete(mainMedia, deleteTelegram);
    } finally {
      setIsDeleting_(false);
      setShowDeleteDialog(false);
    }
  };
  
  // Updated handleView to pass the entire group
  const handleViewClick = () => {
    onView(group);
  };

  // Convert Message[] to MediaItem[] for ImageSwiper
  const mediaItems = group.map(message => ({
    id: message.id,
    public_url: message.public_url,
    mime_type: message.mime_type,
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content
  }));

  return (
    <div className="group relative bg-white dark:bg-gray-950 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="aspect-square overflow-hidden">
        <ImageSwiper
          media={mediaItems}
          onClick={handleViewClick}
          className="w-full h-full object-cover cursor-pointer"
        />
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-medium leading-none truncate max-w-[80%]">
            {mainMedia.analyzed_content?.product_name || "Untitled"}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-8 w-8 p-0"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(mainMedia)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleViewClick}>
                <ExternalLink className="mr-2 h-4 w-4" /> View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {mainMedia.analyzed_content?.vendor_uid || "No vendor"}
          </p>
          {mainMedia.analyzed_content?.product_code && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mainMedia.analyzed_content.product_code}
            </p>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to delete this product from both Telegram and the database, or just from the database?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteClick(true)}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting_ || isDeleting}
            >
              {isDeleting_ && deleteTelegram ? "Deleting..." : "Delete from Both"}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDeleteClick(false)}
              className="bg-yellow-600 hover:bg-yellow-700"
              disabled={isDeleting_ || isDeleting}
            >
              {isDeleting_ && !deleteTelegram ? "Deleting..." : "Delete from Database Only"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
