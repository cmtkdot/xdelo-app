
export interface MediaItem {
  id: string;
  public_url: string;
  mime_type?: string;
  caption?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface MediaItemProps {
  item: MediaItem;
  onClick?: (item: MediaItem) => void;
  className?: string;
}
