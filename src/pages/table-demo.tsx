import { DataTable } from "@/components/ui/data-table";

export default function TableDemoPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Advanced Data Table Example</h1>
      <p className="text-gray-500 mb-8">
        This example showcases a fully featured data table with filtering, sorting, pagination, and row selection.
      </p>
      <DataTable />
    </div>
  );
} 