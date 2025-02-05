
import { MediaItem } from "@/types";

export interface EditableRow extends MediaItem {
  isEditing?: boolean;
}

export interface MessagesTableProps {
  data: MediaItem[];
  isLoading: boolean;
  onUpdate: (id: string, data: Partial<MediaItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
