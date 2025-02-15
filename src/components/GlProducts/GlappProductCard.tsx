
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GlProduct } from "@/types";
import { formatDate } from "@/lib/utils";

interface GlappProductCardProps {
  product: GlProduct;
}

export function GlappProductCard({ product }: GlappProductCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="space-y-1">
          <h3 className="font-semibold truncate">
            {product.product_name_display || product.main_product_name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {product.main_vendor_uid}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {(product.message_public_url || product.main_product_image1) && (
            <img
              src={product.message_public_url || product.main_product_image1}
              alt={product.main_product_name}
              className="w-full h-48 object-cover rounded-md"
            />
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Purchase Date</p>
              <p>{product.main_product_purchase_date ? 
                formatDate(new Date(product.main_product_purchase_date)) : 
                "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Quantity</p>
              <p>{product.main_total_qty_purchased || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost</p>
              <p>${product.main_cost?.toFixed(2) || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <p>{product.main_category || "N/A"}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
