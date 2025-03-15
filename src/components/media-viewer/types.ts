
import { Message } from "@/types/entities/Message";

export interface BaseMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  className?: string;
}

export interface MediaDisplayProps {
  message: Message;
  className?: string;
}

export interface MediaToolbarProps {
  currentMedia: Message;
  showTools: boolean;
  onToggleTools: () => void;
  messageIds: string[];
  className?: string;
}
