import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";

interface MediaGridProps {
  mediaGroups: { [key: string]: MediaItem[] };
  onEdit: (media: MediaItem) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export const MediaGrid = ({ 
  mediaGroups,
  onEdit,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext
}: MediaGridProps) => {
  const groupsArray = Object.values(mediaGroups);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {groupsArray.map((group, index) => (
        <ProductGroup
          key={group[0].id}
          group={group}
          onEdit={onEdit}
          onPrevious={onPrevious}
          onNext={onNext}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
        />
      ))}
    </div>
  );
};