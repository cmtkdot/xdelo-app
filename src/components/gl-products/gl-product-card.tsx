import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Product } from "@/types/Product";

interface GlProductCardProps {
  product: Product;
  onView: (product: Product) => void;
}

export function GlProductCard({ product, onView }: GlProductCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square relative">
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="object-cover w-full h-full"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium mb-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">
            {product.price ? `$${product.price.toFixed(2)}` : "N/A"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(product)}
          >
            View Details
          </Button>
        </div>
      </div>
    </Card>
  );
};
