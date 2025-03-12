
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const MessagesTableHeader: React.FC = () => {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Media</TableHead>
        <TableHead>Product Name</TableHead>
        <TableHead>Vendor UID</TableHead>
        <TableHead>Purchase Date</TableHead>
        <TableHead>Quantity</TableHead>
        <TableHead>Notes</TableHead>
        <TableHead>Original Caption</TableHead>
        <TableHead className="w-[100px]">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};
