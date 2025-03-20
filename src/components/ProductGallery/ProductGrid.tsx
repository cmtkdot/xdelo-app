
import React from 'react';
import { cn } from "@/lib/utils";
import { GlProduct } from '@/types/GlProducts';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileEdit, Trash2 } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface ProductGridProps {
  products: GlProduct[];
  onEdit: (product: GlProduct) => void;
  onDelete: (product: GlProduct) => Promise<void>;
  className?: string;
  isDeleting?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products = [],
  onEdit,
  onDelete,
  className,
  isDeleting = false
}) => {
  if (!products || !Array.isArray(products)) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        "grid-cols-2",
        "md:grid-cols-3",
        "lg:grid-cols-4",
        className
      )}
    >
      {products.map((product) => (
        <Card key={product.id}>
          <CardContent className="p-2">
            <AspectRatio ratio={1 / 1}>
              <img
                src={product.main_product_image1 || '/placeholder.svg'}
                alt={product.main_new_product_name || 'Product'}
                className="w-full h-full object-cover rounded-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder.svg';
                  target.classList.add('bg-gray-200');
                }}
              />
            </AspectRatio>
            <p className="text-sm mt-2 truncate font-medium">
              {product.main_new_product_name || product.product_name_display || 'No product name'}
            </p>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {product.main_vendor_product_name || 'No vendor'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-between items-center p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(product)}
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(product)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
