import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { Card } from "@/components/ui/card";

interface ProductGridProps {
  mediaGroups: { [key: string]: MediaItem[] };
  onEdit: (media: MediaItem) => void;
  onGroupSelect: (index: number) => void;
  selectedGroupIndex: number | null;
  onPrevious: () => void;
  onNext: () => void;
}

export const ProductGrid = ({ 
  mediaGroups, 
  onEdit,
  onGroupSelect,
  selectedGroupIndex,
  onPrevious,
  onNext
}: ProductGridProps) => {
  const groupsArray = Object.values(mediaGroups);

  if (groupsArray.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-gray-500">No products yet</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
      {groupsArray.map((group, index) => (
        <ProductGroup
          key={group[0].id}
          group={group}
          onEdit={onEdit}
          onPrevious={onPrevious}
          onNext={onNext}
          hasPrevious={selectedGroupIndex !== null && selectedGroupIndex > 0}
          hasNext={selectedGroupIndex !== null && selectedGroupIndex < groupsArray.length - 1}
        />
      ))}
    </div>
  );
};