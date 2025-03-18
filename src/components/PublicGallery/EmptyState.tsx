
import { SearchX, Image } from "lucide-react";

interface EmptyStateProps {
  message?: string;
}

export const EmptyState = ({ message }: EmptyStateProps) => {
  const isSearchEmpty = message && message.includes("search");
  
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      {isSearchEmpty ? (
        <SearchX className="w-16 h-16 text-muted-foreground mb-4" />
      ) : (
        <Image className="w-16 h-16 text-muted-foreground mb-4" />
      )}
      
      <h3 className="text-xl font-semibold mb-2">
        {isSearchEmpty ? "No results found" : "No items in gallery"}
      </h3>
      
      <p className="text-muted-foreground max-w-md">
        {message || "There are no media items to display in the gallery at this time."}
      </p>
    </div>
  );
};
