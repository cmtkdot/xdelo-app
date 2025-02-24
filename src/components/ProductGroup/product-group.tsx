
import { type Message } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProductGroupProps {
  group: Message[];
  onEdit?: (media: Message) => void;
  onDelete?: (media: Message) => void;
  onView?: () => void;
}

export const ProductGroup = ({
  group,
  onEdit,
  onDelete,
  onView,
}: ProductGroupProps) => {
  // Ensure group is an array before mapping
  const safeGroup = Array.isArray(group) ? group : [];
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safeGroup.map((media) => (
          <Card
            key={media.id}
            className="overflow-hidden cursor-pointer hover:shadow-lg transition-all"
            onClick={onView}
          >
            <div className="aspect-video relative">
              {media.public_url && (
                <img
                  src={media.public_url}
                  alt={media.caption || "Media"}
                  className="object-cover w-full h-full"
                />
              )}
            </div>
            <div className="p-3 flex justify-between items-center">
              <p className="text-sm text-muted-foreground truncate">
                {media.caption || "No caption"}
              </p>
              <div className="flex gap-2">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(media);
                    }}
                  >
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(media);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
