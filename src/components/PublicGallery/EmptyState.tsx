import { SearchX, Image, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  message?: string;
  isNetworkError?: boolean;
  onTryAgain?: () => void;
}

export const EmptyState = ({ message, isNetworkError = false, onTryAgain }: EmptyStateProps) => {
  const isSearchEmpty = message && message.includes("search");
  
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      {isNetworkError ? (
        <WifiOff className="w-16 h-16 text-destructive mb-4" />
      ) : isSearchEmpty ? (
        <SearchX className="w-16 h-16 text-muted-foreground mb-4" />
      ) : (
        <Image className="w-16 h-16 text-muted-foreground mb-4" />
      )}
      
      <h3 className="text-xl font-semibold mb-2">
        {isNetworkError 
          ? "Connection Issue" 
          : isSearchEmpty 
            ? "No results found" 
            : "No items in gallery"}
      </h3>
      
      <p className="text-muted-foreground max-w-md mb-4">
        {isNetworkError
          ? "Unable to connect to the server. Please check your internet connection or try again later."
          : message || "There are no media items to display in the gallery at this time."}
      </p>
      
      {(isNetworkError || !isSearchEmpty) && onTryAgain && (
        <Button 
          onClick={onTryAgain}
          variant="outline"
          className="mt-2 gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Gallery
        </Button>
      )}
    </div>
  );
};
