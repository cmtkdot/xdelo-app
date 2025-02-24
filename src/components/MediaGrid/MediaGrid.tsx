
import { type Message } from "@/types";
import { ProductGroup } from "@/components/ProductGroup/product-group";

interface MediaGridProps {
  groups: Message[][];
  onEdit?: (media: Message) => void;
  onDelete?: (media: Message) => void;
  onView?: () => void;
}

export const MediaGrid = ({
  groups,
  onEdit,
  onDelete,
  onView,
}: MediaGridProps) => {
  // Ensure groups is an array
  const safeGroups = Array.isArray(groups) ? groups : [];

  return (
    <div className="space-y-8">
      {safeGroups.map((group, index) => (
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
