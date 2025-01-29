import { Card } from "@/components/ui/card";
import { MessageSquare, Package, Users } from "lucide-react";

const stats = [
  {
    name: "Total Messages",
    value: "0",
    icon: MessageSquare,
    change: "+0%",
    changeType: "positive",
  },
  {
    name: "Products Created",
    value: "0",
    icon: Package,
    change: "+0%",
    changeType: "positive",
  },
  {
    name: "Active Vendors",
    value: "0",
    icon: Users,
    change: "+0%",
    changeType: "positive",
  },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.name} className="p-6">
            <div className="flex items-center gap-4">
              <stat.icon className="h-6 w-6 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;