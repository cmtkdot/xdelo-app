import { type Product } from "@/types/Product";
import { GlappProductCard } from "./glapp-product-card";

interface GlappProductGridProps {
  products: Product[];
  onViewProduct: (product: Product) => void;
}

export const GlappProductGrid = ({
  products,
  onViewProduct,
}: GlappProductGridProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <GlappProductCard
          key={product.id}
          product={product}
          onView={onViewProduct}
        />
      ))}
    </div>
  );
};
