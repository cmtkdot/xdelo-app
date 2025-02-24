import { Message } from "@/types";
import { ProductGroup } from "@/components/ProductGroup/ProductGroup";

interface MediaGridProps {
  mediaGroups: { [key: string]: Message[] };
  onEdit: (media: Message) => void;
  onDelete: (media: Message) => void;
  onView: () => void;
}

export const MediaGrid = ({ 
  mediaGroups,
  onEdit,
  onDelete,
  onView
}: MediaGridProps) => {
  const groupsArray = Object.values(mediaGroups);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      {groupsArray.map((group) => (
        <ProductGroup
          key={group[0].id}
          group={group}
          onEdit={onEdit}
          onView={onView}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}; 