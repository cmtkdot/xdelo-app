
import { Message } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { getMainMediaFromGroup } from "@/components/MediaViewer/types";

interface MediaGridProps {
  mediaGroups: { [key: string]: Message[] };
  onEdit: (media: Message) => void;
  onView?: (group: Message[]) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export const MediaGrid = ({ 
  mediaGroups,
  onEdit,
  onView,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext
}: MediaGridProps) => {
  const groupsArray = Object.values(mediaGroups);

  // Create a dummy Promise-based delete function that resolves immediately
  const handleDelete = async (media: Message): Promise<void> => {
    return Promise.resolve();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      {groupsArray.map((group, index) => {
        // Skip empty groups
        if (!group || group.length === 0) return null;
        
        // Get the most representative media from the group for display
        const mainMedia = getMainMediaFromGroup(group);
        if (!mainMedia) return null;
        
        return (
          <ProductGroup
            key={mainMedia.id}
            group={group}
            onEdit={onEdit}
            onView={onView ? () => onView(group) : undefined}
            onDelete={handleDelete}
          />
        );
      })}
    </div>
  );
}
