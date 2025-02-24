
import { type Message } from "@/types/Message";
import { GlProductCard } from "./gl-product-card";

interface GlProductGridProps {
  products: Message[][];
  onViewProduct: (product: Message[]) => void;
}

export function GlProductGrid({ products, onViewProduct }: GlProductGridProps) {
  const safeProducts = Array.isArray(products) ? products : [];
  
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {safeProducts.map((product, index) => (
        <GlProductCard
          key={product[0]?.id || index}
          product={product}
          onView={onViewProduct}
        />
      ))}
    </div>
  );
}
