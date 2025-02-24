import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { GlappProductGrid } from "@/components/gl-products/glapp-product-grid";
import { GlappProductFilters } from "@/components/gl-products/glapp-product-filters";

export default function GlProducts() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">GL Products</h1>
      <Card className="p-4">
        <GlappProductFilters />
      </Card>
      <Suspense fallback={<div>Loading...</div>}>
        <GlappProductGrid />
      </Suspense>
    </div>
  );
}
