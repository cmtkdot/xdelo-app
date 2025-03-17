
import React from "react";
import { ImageIcon } from "lucide-react";

export const EmptyState: React.FC = () => {
  return (
    <div className="text-center py-8 md:py-12 bg-muted/20 rounded-lg">
      <ImageIcon className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground mx-auto mb-3 md:mb-4" />
      <p className="text-muted-foreground text-base md:text-lg">No media found</p>
      <p className="text-muted-foreground text-xs md:text-sm mt-1">Try a different filter or check back later</p>
    </div>
  );
};
