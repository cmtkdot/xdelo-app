
import { Card } from "@/components/ui/card";

interface AccountCardProps {
  userEmail: string | null;
}

export function AccountCard({ userEmail }: AccountCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-medium">Account Settings</h3>
      <p className="mt-2 text-sm text-gray-600">Email: {userEmail}</p>
    </Card>
  );
}
