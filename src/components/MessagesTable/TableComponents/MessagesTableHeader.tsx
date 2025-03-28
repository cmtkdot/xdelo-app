/**
 * @deprecated This component is no longer used. Table header has been integrated into MessagesTable.tsx
 * Keep this file for reference until all usages have been migrated.
 */

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
