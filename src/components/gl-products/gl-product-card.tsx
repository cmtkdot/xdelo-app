
import { type Message } from "@/types";

interface ProductCardProps {
  product: Message[];
  onView: (product: Message[]) => void;
}

export function GlProductCard({ product, onView }: ProductCardProps) {
  // Use the first item in the array for the main display
  const mainProduct = product[0];

  return (
    <div 
      className="group relative overflow-hidden rounded-lg border bg-card hover:shadow-lg transition-all"
      onClick={() => onView(product)}
    >
      <div className="aspect-video relative">
        {mainProduct?.public_url && (
          <img
            src={mainProduct.public_url}
            alt={mainProduct.caption || "Product"}
            className="object-cover w-full h-full"
          />
        )}
      </div>
      <div className="p-3">
        <p className="text-sm text-muted-foreground truncate">
          {mainProduct?.caption || "No caption"}
        </p>
      </div>
    </div>
  );
}
