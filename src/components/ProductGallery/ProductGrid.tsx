
import { Message } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: Message[][];
  onEdit: (media: Message) => void;
  onDelete: (media: Message, deleteTelegram: boolean) => Promise<void>;
  onView: () => void;
  className?: string;
  isDeleting?: boolean;
}

export const ProductGrid = ({
  products = [], // Provide default empty array
  onEdit,
  onDelete,
  onView,
  className,
  isDeleting = false
}: ProductGridProps) => {
  // Guard against undefined products
  if (!Array.isArray(products)) {
    return null;
  }

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
      {products.map((group, index) => {
        // Ensure we have valid messages in the group
        if (!group || group.length === 0) return null;
        
        return (
          <ProductGroup
            key={group[0]?.id || index}
            group={group}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            isDeleting={isDeleting}
          />
        );
      })}
    </div>
  );
};
