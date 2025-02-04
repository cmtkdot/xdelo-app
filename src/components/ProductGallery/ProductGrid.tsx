import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { Card } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";

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

  const convertToMessage = (item: MediaItem): Tables<'messages'>['Row'] => ({
    ...item,
    chat_id: null,
    chat_type: null,
    glide_sync_json: null,
    glide_sync_status: null,
    storage_path: null,
    last_synced_at: null,
    group_first_message_time: null,
    group_last_message_time: null,
    purchase_order_uid: null
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
      {groupsArray.map((group, index) => (
        <ProductGroup
          key={group[0].id}
          message={convertToMessage(group[0])}
          onSelect={() => onGroupSelect(index)}
          selected={selectedGroupIndex === index}
          showDetails={true}
          onPrevious={onPrevious}
          onNext={onNext}
          hasPrevious={selectedGroupIndex !== null && selectedGroupIndex > 0}
          hasNext={selectedGroupIndex !== null && selectedGroupIndex < groupsArray.length - 1}
        />
      ))}
    </div>
  );
};