import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { Card } from "@/components/ui/card";

interface ProductGridProps {
  mediaGroups: { [key: string]: MediaItem[] };
  onEdit?: (media: MediaItem) => void;
}

export const ProductGrid = ({ mediaGroups, onEdit }: ProductGridProps) => {
  if (Object.keys(mediaGroups).length === 0) {
    return (
      <Card className="p-6">
        <p className="text-gray-500">No products yet</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
      {Object.values(mediaGroups).map((group) => (
        <ProductGroup
          key={group[0].id}
          group={group}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};