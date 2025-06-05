
import { GlProduct } from "@/types";
import { GLProductCard } from "./GLProductCard";

interface GLProductGridProps {
  products: GlProduct[];
}

export function GLProductGrid({ products }: GLProductGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((product) => (
        <GLProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
