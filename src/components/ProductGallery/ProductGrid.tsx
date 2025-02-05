
import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";

interface ProductGridProps {
  mediaGroups: { [key: string]: MediaItem[] };
  onEdit: (media: MediaItem) => void;
  onDelete: (media: MediaItem) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ mediaGroups, onEdit, onDelete }) => {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(-1);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleOpenViewer = (index: number) => {
    setSelectedGroupIndex(index);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setSelectedGroupIndex(-1);
  };

  const handlePreviousGroup = () => {
    setSelectedGroupIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextGroup = () => {
    setSelectedGroupIndex((prev) => Math.min(Object.values(mediaGroups).length - 1, prev + 1));
  };

  const groupsArray = Object.values(mediaGroups);

  if (groupsArray.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-gray-500">No products yet</p>
      </Card>
    );
  }

  const gridCols = "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={`grid ${gridCols} gap-3 md:gap-4 auto-rows-fr`}>
      {groupsArray.map((group, index) => (
        <ProductGroup
          key={group[0].id}
          group={group}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={() => handleOpenViewer(index)}
        />
      ))}

      {isViewerOpen && selectedGroupIndex >= 0 && (
        <MediaViewer
          isOpen={isViewerOpen}
          onClose={handleCloseViewer}
          currentGroup={groupsArray[selectedGroupIndex]}
          onPrevious={handlePreviousGroup}
          onNext={handleNextGroup}
          hasPrevious={selectedGroupIndex > 0}
          hasNext={selectedGroupIndex < groupsArray.length - 1}
        />
      )}
    </div>
  );
};
