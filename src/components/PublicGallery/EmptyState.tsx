
import { ImageIcon } from "lucide-react";

export const EmptyState = () => {
  return (
    <div className="text-center py-12 bg-muted/20 rounded-lg">
      <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground text-lg">No media found</p>
      <p className="text-muted-foreground text-sm mt-1">Try a different filter or check back later</p>
    </div>
  );
};
