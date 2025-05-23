
import React, { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, FileEdit, Eye, Trash2, ArrowUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Message } from "@/types";
import { format } from 'date-fns';

interface MediaTableProps {
  data: Message[];
  onEdit: (media: Message) => void;
  onView?: (media: Message) => void;
  onDelete: (media: Message) => Promise<void>;
}

export const MediaTable: React.FC<MediaTableProps> = ({ data, onEdit, onView, onDelete }) => {
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true }
  ]);

  const columns: ColumnDef<Message>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : undefined)}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => {
        const id = row.getValue("id") as string;
        return <span className="text-xs font-mono">{id.substring(0, 8)}...</span>;
      },
    },
    {
      accessorKey: "product_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent"
          >
            Product
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const value = row.getValue("product_name") as string;
        return (
          <div className="font-medium max-w-[200px] truncate">
            {value || <span className="text-muted-foreground italic">Unnamed</span>}
          </div>
        );
      },
    },
    {
      accessorKey: "vendor_uid",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent"
          >
            Vendor
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const value = row.getValue("vendor_uid") as string;
        return value ? (
          <Badge variant="outline" className="font-normal">
            {value}
          </Badge>
        ) : null;
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const value = row.getValue("created_at") as string;
        return value ? format(new Date(value), "MMM d, yyyy") : null;
      },
    },
    {
      accessorKey: "caption",
      header: "Caption",
      cell: ({ row }) => {
        const caption = row.getValue("caption") as string;
        return (
          <div className="max-w-[300px] truncate">
            {caption ? caption : <span className="text-muted-foreground italic">No caption</span>}
          </div>
        );
      },
    },
    {
      accessorKey: "mime_type",
      header: "Type",
      cell: ({ row }) => {
        const mimeType = row.getValue("mime_type") as string;
        if (!mimeType) return null;
        
        const type = mimeType.split('/')[0];
        return (
          <Badge variant={type === 'image' ? "secondary" : "default"}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const duration = row.getValue("duration");
        if (!duration) return null;
        
        // Convert to number if it's a string
        const durationNum = typeof duration === 'string' ? parseInt(duration, 10) : duration as number;
        
        if (isNaN(durationNum)) return null;
        
        return (
          <span>
            {Math.floor(durationNum)}s
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const media = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(media)}>
                <FileEdit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {onView && (
                <DropdownMenuItem onClick={() => onView(media)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete(media)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      rowSelection,
      sorting,
    },
  })

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onView ? onView(row.original) : onEdit(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} onClick={(e) => {
                      // Prevent row click when clicking on checkboxes or action buttons
                      if (cell.column.id === "select" || cell.column.id === "actions") {
                        e.stopPropagation();
                      }
                    }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
