
import React from 'react';
import { ListIcon } from "lucide-react";

export const EmptyList: React.FC = () => {
  return (
    <div className="text-center py-12 border rounded-md bg-muted/20">
      <ListIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground text-lg">No messages to display</p>
      <p className="text-muted-foreground text-sm mt-1">Try changing your search criteria</p>
    </div>
  );
};
