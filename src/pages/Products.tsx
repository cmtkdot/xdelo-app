import { Card } from "@/components/ui/card";

const Products = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Products</h2>
      </div>
      <Card className="p-6">
        <p className="text-gray-500">No products yet</p>
      </Card>
    </div>
  );
};

export default Products;