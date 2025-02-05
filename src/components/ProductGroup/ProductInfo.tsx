
import { MediaItem } from "@/types";
import { formatDate, getAnalyzedContent } from "./utils";

interface ProductInfoProps {
  group: MediaItem[];
}

export const ProductInfo = ({ group }: ProductInfoProps) => {
  const analyzedContent = getAnalyzedContent(group);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-3 text-white">
      <h3 className="text-base md:text-lg font-semibold mb-1">
        {analyzedContent?.product_name || 'Untitled Product'}
      </h3>
      <div className="text-sm opacity-90">
        {formatDate(analyzedContent?.purchase_date)}
      </div>
    </div>
  );
};

