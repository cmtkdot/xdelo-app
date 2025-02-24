
import { Message } from "@/types";

interface ProductGridProps {
  products: Message[][];
  onEdit?: (media: Message) => void;
  onDelete?: (media: Message) => void;
  onView?: () => void;
}

export const ProductGrid = ({ 
  products,
  onEdit,
  onDelete,
  onView,
}: ProductGridProps) => {
  // Ensure products is an array before mapping
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <div className="space-y-8">
      {safeProducts.map((group, index) => {
        // Ensure each group is an array
        const safeGroup = Array.isArray(group) ? group : [];
        
        return (
          <div key={index} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {safeGroup.map((media) => (
                <div
                  key={media.id}
                  className="group relative overflow-hidden rounded-lg border bg-card hover:shadow-lg transition-all"
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
                        <button
                          className="text-sm text-blue-500 hover:text-blue-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(media);
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className="text-sm text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(media);
                          }}
                        >
                          Delete
                        </button>
                      )}
                      {onView && (
                        <button
                          className="text-sm text-gray-500 hover:text-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            onView();
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
