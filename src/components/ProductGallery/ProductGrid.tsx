import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: MediaItem[][];
  onEdit: (media: MediaItem) => void;
  onDelete: (media: MediaItem) => void;
  onView: () => void;
  className?: string;
}

export const ProductGrid = ({
  products,
  onEdit,
  onDelete,
  onView,
  className
}: ProductGridProps) => {
  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        // Default to 1 column on mobile, 2 on small tablets
        "grid-cols-1 sm:grid-cols-2",
        // 3 columns on medium screens
        "md:grid-cols-3",
        // Max out at 4 columns on large screens
        "lg:grid-cols-4",
        // Optional 5th column on extra large screens
        "2xl:grid-cols-5",
        className
      )}
    >
      {products.map((group, index) => (
        <ProductGroup
          key={group[0]?.id || index}
          group={group}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ))}
    </div>
  );
};
