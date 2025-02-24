import { type Product } from "@/types/Product";
import { GlProductCard } from "./gl-product-card";

interface GlProductGridProps {
  products: Product[];
  onViewProduct: (product: Product) => void;
}

export function GlProductGrid({ products, onViewProduct }: GlProductGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <GlProductCard
          key={product.id}
          product={product}
          onView={onViewProduct}
        />
      ))}
    </div>
  );
}
