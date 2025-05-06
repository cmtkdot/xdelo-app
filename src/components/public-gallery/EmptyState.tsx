import { SearchX } from "lucide-react";

interface EmptyStateProps {
  message?: string;
  subMessage?: string;
  searchTerm?: string;
}

export const EmptyState = ({
  message = "No items found",
  subMessage = "Try adjusting your filters or search term",
  searchTerm,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      <div className="mb-4 p-4 rounded-full bg-muted">
        <SearchX className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{message}</h3>
      <p className="text-muted-foreground max-w-md">
        {searchTerm ? `No results for "${searchTerm}"` : subMessage}
      </p>
    </div>
  );
};
