import { Card } from "@/components/ui/card";

const Vendors = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Vendors</h2>
      </div>
      <Card className="p-6">
        <p className="text-gray-500">No vendors yet</p>
      </Card>
    </div>
  );
};

export default Vendors;