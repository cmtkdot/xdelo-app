
import React from 'react';
import { DataTable } from '@/components/ui/data-table';

type Person = {
  id: string;
  name: string;
  email: string;
};

const columns = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
];

export default function TableDemo() {
  const data: Person[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
    },
  ];

  return (
    <div className="container mx-auto py-10">
      <DataTable
        columns={columns}
        data={data}
      />
    </div>
  );
}
