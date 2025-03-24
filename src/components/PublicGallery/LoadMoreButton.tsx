
import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  hasMoreItems: boolean;
}

export const LoadMoreButton = ({ 
  onClick, 
  isLoading = false,
  hasMoreItems
}: LoadMoreButtonProps) => {
  if (!hasMoreItems) return null;
  
  return (
    <div className="w-full flex justify-center my-8">
      <Button
        variant="outline"
        size="lg"
        onClick={onClick}
        disabled={isLoading}
        className="px-6 py-6 rounded-full flex items-center gap-2 transition-all hover:bg-muted"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
        {isLoading ? "Loading..." : "Load More"}
      </Button>
    </div>
  );
};
