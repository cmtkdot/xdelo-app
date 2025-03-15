
import React from 'react';
import { FileX } from 'lucide-react';

export const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 border rounded-md bg-card text-card-foreground">
      <FileX className="h-12 w-12 text-muted-foreground mb-2" />
      <h3 className="text-lg font-medium">No messages found</h3>
      <p className="text-muted-foreground text-center mt-1">
        Try adjusting your filters or refresh the data
      </p>
    </div>
  );
};
