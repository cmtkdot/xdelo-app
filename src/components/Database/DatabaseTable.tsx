import React, { useState, useEffect } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// Define types for the message data - following the TypeScript standards from the project rules
export type MessageData = {
  id: string;
  telegram_message_id: number | null;
  chat_title: string | null;
  media_group_id: string | null;
  caption: string | null;
  file_unique_id: string | null;
  public_url: string | null;
  processing_state: string;
  correlation_id: string | null;
  product_name: string | null;
  product_code: string | null;
  vendor_uid: string | null;
  media_group_sync: boolean | null;
  product_sku: string | null;
  message_url: string | null;
  glide_row_id: string | null;
  // Additional columns
  message_data: Record<string, any> | null;
  caption_data: string | null;
  analyzed_content: Record<string, any> | null;
  telegram_data: Record<string, any> | null;
};

export function DatabaseTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile devices and adjust column visibility accordingly
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initialize on mount
    checkIsMobile();
    
    // Set up responsive column visibility
    if (isMobile) {
      setColumnVisibility({
        id: true,
        telegram_message_id: true,
        caption: true,
        processing_state: true,
        product_name: true,
        // Hide other columns on mobile
        chat_title: false,
        media_group_id: false,
        product_code: false,
        public_url: false,
        caption_data: false,
        analyzed_content: false,
        message_url: false,
        message_data: false,
        telegram_data: false,
      });
    }
    
    // Listen for window resize
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, [isMobile]);

  // Fetch message data using TanStack Query for data fetching (as per the project standards)
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, telegram_message_id, chat_title, media_group_id, caption, file_unique_id, public_url, processing_state, correlation_id, product_name, product_code, vendor_uid, media_group_sync, product_sku, message_url, glide_row_id, message_data, caption_data, analyzed_content, telegram_data"
        )
        .order("telegram_message_id", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as MessageData[];
    },
  });

  // Define table columns
  const columns: ColumnDef<MessageData>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <div className="truncate max-w-[100px]" title={row.getValue("id")}>
          {(row.getValue("id") as string).substring(0, 8)}...
        </div>
      ),
    },
    {
      accessorKey: "telegram_message_id",
      header: "Message ID",
      cell: ({ row }) => row.getValue("telegram_message_id") || "-",
    },
    {
      accessorKey: "chat_title",
      header: "Chat Title",
      cell: ({ row }) => (
        <div className="max-w-[150px] truncate">
          {row.getValue("chat_title") || "-"}
        </div>
      ),
    },
    {
      accessorKey: "media_group_id",
      header: "Media Group",
      cell: ({ row }) => {
        const mediaGroupId = row.getValue("media_group_id") as string | null;
        return mediaGroupId ? (
          <div className="truncate max-w-[100px]" title={mediaGroupId}>
            {mediaGroupId.substring(0, 8)}...
          </div>
        ) : (
          "-"
        );
      },
    },
    {
      accessorKey: "caption",
      header: "Caption",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate">
          {row.getValue("caption") || "-"}
        </div>
      ),
    },
    {
      accessorKey: "processing_state",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("processing_state") as string;
        return (
          <Badge 
            variant={
              status === "processed" 
                ? "success" 
                : status === "error" 
                  ? "destructive" 
                  : status === "processing" 
                    ? "warning"
                    : "secondary"
            }
            className="capitalize"
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "caption_data",
      header: "Caption Data",
      cell: ({ row }) => (
        <div className="max-w-[150px] truncate">
          {row.getValue("caption_data") || "-"}
        </div>
      ),
    },
    {
      accessorKey: "analyzed_content",
      header: "Analyzed Content",
      cell: ({ row }) => {
        const content = row.getValue("analyzed_content") as Record<string, any> | null;
        return (
          <div className="max-w-[150px] truncate">
            {content ? "✓" : "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "product_name",
      header: "Product Name",
      cell: ({ row }) => (
        <div className="max-w-[150px] truncate">
          {row.getValue("product_name") || "-"}
        </div>
      ),
    },
    {
      accessorKey: "product_code",
      header: "Product Code",
      cell: ({ row }) => row.getValue("product_code") || "-",
    },
    {
      accessorKey: "public_url",
      header: "URL",
      cell: ({ row }) => {
        const url = row.getValue("public_url") as string | null;
        return url ? (
          <Button variant="link" size="sm" asChild className="p-0 h-auto">
            <a href={url} target="_blank" rel="noopener noreferrer">
              View
            </a>
          </Button>
        ) : (
          "-"
        );
      },
    },
    {
      accessorKey: "message_url",
      header: "Message URL",
      cell: ({ row }) => {
        const url = row.getValue("message_url") as string | null;
        return url ? (
          <Button variant="link" size="sm" asChild className="p-0 h-auto">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
          </Button>
        ) : (
          "-"
        );
      },
    },
  ];

  const table = useReactTable({
    data: messages || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Database Messages</CardTitle>
          <CardDescription>Error loading messages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-6">
            <p className="text-destructive">Error: {(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 justify-between items-center md:flex-row">
        <Input
          placeholder="Filter by product name..."
          value={(table.getColumn("product_name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("product_name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id.replace(/_/g, " ")}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
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
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Show skeleton loaders during data fetching for better UX
                Array.from({ length: isMobile ? 5 : 10 }).map((_, index) => (
                  <TableRow key={`loading-${index}`}>
                    {Array.from({ length: isMobile ? 4 : columns.length }).map((_, colIndex) => (
                      <TableCell key={`loading-cell-${colIndex}`}>
                        <Skeleton className="w-full h-4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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

      <div className="flex flex-col gap-2 justify-between items-center sm:flex-row">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) displayed.
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex gap-1 items-center mr-2">
            <span className="text-sm font-medium">Page</span>
            <span className="text-sm text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-0 w-8 h-8"
            aria-label="Previous page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-0 w-8 h-8"
            aria-label="Next page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
