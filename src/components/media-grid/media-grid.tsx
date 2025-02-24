import { Message } from "@/types";
import { ProductGroup } from "@/components/product-group/product-group";

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
  onView,
}: MediaGridProps) => {
  return (
    <div className="space-y-8">
      {Object.entries(mediaGroups).map(([groupId, messages]) => (
        <ProductGroup
          key={groupId}
          groupId={groupId}
          messages={messages}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ))}
    </div>
  );
};
