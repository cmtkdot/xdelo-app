
import { Message } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { logMessageOperation } from "@/lib/unifiedLogger";

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

  // Create a dummy Promise-based delete function that logs the operation
  const handleDelete = async (media: Message, deleteTelegram: boolean): Promise<void> => {
    await logMessageOperation("deleted", media.id, {
      media_group_id: media.media_group_id || 'none',
      delete_telegram: deleteTelegram,
      component: 'MediaGrid',
      is_dummy_handler: true
    });
    
    return Promise.resolve();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      {groupsArray.map((group, index) => (
        <ProductGroup
          key={group[0].id}
          group={group}
          onEdit={onEdit}
          onView={onView ? () => onView(group) : undefined}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};
