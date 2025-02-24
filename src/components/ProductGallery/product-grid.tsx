
import { Message } from "@/types";
import { ProductGroup } from "@/components/ProductGroup/product-group";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: Message[][];
  onEdit: (media: Message) => void;
  onDelete: (media: Message) => void;
  onView: () => void;
  className?: string;
}

export const ProductGrid = ({
  products = [],
  onEdit,
  onDelete,
  onView,
  className
}: ProductGridProps) => {
  if (!Array.isArray(products)) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        "grid-cols-1 sm:grid-cols-2",
        "md:grid-cols-3",
        "lg:grid-cols-4",
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
