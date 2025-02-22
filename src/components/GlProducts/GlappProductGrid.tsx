
import { GlProduct } from "@/types";
import { GlappProductCard } from "./GlappProductCard";

interface GlappProductGridProps {
  products: GlProduct[];
}

export function GlappProductGrid({ products }: GlappProductGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((product) => (
        <GlappProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
