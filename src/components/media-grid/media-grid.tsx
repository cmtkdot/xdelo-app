
import { type Message } from "@/types/Message";
import { ProductGroup } from "../product-group/product-group";

interface MediaGridProps {
  mediaGroups: Message[][];
  onEdit?: (media: Message) => void;
  onDelete?: (media: Message) => void;
  onView?: () => void;
}

export const MediaGrid = ({ 
  mediaGroups,
  onEdit,
  onDelete,
  onView,
}: MediaGridProps) => {
  return (
    <div className="space-y-8">
      {Array.isArray(mediaGroups) && mediaGroups.map((group, index) => (
        <ProductGroup
          key={index}
          group={group}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ))}
    </div>
  );
};
