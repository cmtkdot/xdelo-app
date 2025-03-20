import { Message } from "@/types";
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/generalUtils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChevronDown, MoreHorizontal, Search, Trash } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Define a custom filter function for searching captions
const captionFilterFn: FilterFn<Message> = (row, columnId, filterValue) => {
  const caption = row.original.caption || "";
  const searchTerm = (filterValue ?? "").toLowerCase();
  return caption.toLowerCase().includes(searchTerm);
};

// Format file size helper function
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Define deletion types
type DeletionType = 'database' | 'telegram' | 'both';

interface GalleryTableViewProps {
  messages: Message[];
  onMediaClick: (message: Message) => void;
  onDeleteMessage: (id: string) => Promise<void>;
}

export function GalleryTableView({ messages, onMediaClick, onDeleteMessage }: GalleryTableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<DeletionType>('database');
  
  // Handle delete with options
  const handleDeleteWithOptions = useCallback(async (id: string, type: DeletionType) => {
    try {
      // For both database and telegram options
      const updateData: Record<string, any> = {};
      
      if (type === 'database' || type === 'both') {
        updateData.deleted_from_telegram = true;
      }
      
      if (type === 'telegram' || type === 'both') {
        updateData.pending_telegram_deletion = true;
      }
      
      // Update the message in database with appropriate flags
      const { error } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      await onDeleteMessage(id);
      
      // Show appropriate success message
      if (type === 'both') {
        toast.success("Item deleted from database and queued for Telegram deletion");
      } else if (type === 'database') {
        toast.success("Item deleted from database");
      } else {
        toast.success("Item queued for Telegram deletion");
      }
    } catch (error) {
      console.error("Error in delete operation:", error);
      toast.error("Failed to delete item");
    } finally {
      setItemToDelete(null);
    }
  }, [onDeleteMessage]);
  
  // Wrapper function for handleDeleteWithOptions to use in UI callbacks
  const deleteItem = useCallback((id: string, type: DeletionType) => {
    handleDeleteWithOptions(id, type);
  }, [handleDeleteWithOptions]);

  // Handle bulk delete for selected rows
  const handleBulkDelete = useCallback(async (type: DeletionType = 'database') => {
    const selectedRowsRef = tableRef.current?.getSelectedRowModel().rows;
    if (!selectedRowsRef || selectedRowsRef.length === 0) return;
    
    const selectedIds = selectedRowsRef.map(row => row.original.id);
    
    // Show loading toast
    toast.loading(`Deleting ${selectedIds.length} items...`);
    
    try {
      // Delete each selected message one by one
      for (const id of selectedIds) {
        await handleDeleteWithOptions(id, type);
      }
      
      // Show success
      toast.success(`${selectedIds.length} items deleted successfully`);
      
      // Clear selection after deletion
      tableRef.current?.resetRowSelection();
    } catch (error) {
      toast.error("Error deleting some items");
      console.error("Bulk delete error:", error);
    }
  }, [handleDeleteWithOptions]);

  // Create a ref for the table instance
  const tableRef = useRef(null);

  // Define table columns
  const columns = useMemo<ColumnDef<Message>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() 
              ? true 
              : table.getIsSomePageRowsSelected() 
                ? "indeterminate" 
                : false
          }
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
      id: "preview",
      header: "Preview",
      cell: ({ row }) => {
        const message = row.original;
        const mimeType = message.mime_type || "";
        
        return (
          <div className="relative h-12 w-12 cursor-pointer" onClick={() => onMediaClick(message)}>
            {mimeType.startsWith("image/") ? (
              <img 
                src={message.public_url} 
                alt={message.caption || "Preview"} 
                className="h-full w-full object-cover rounded"
              />
            ) : mimeType.startsWith("video/") ? (
              <div className="h-full w-full bg-gray-100 rounded flex items-center justify-center">
                <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            ) : (
              <div className="h-full w-full bg-gray-100 rounded flex items-center justify-center">
                <span className="text-xs text-gray-500">File</span>
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "caption",
      header: "Caption",
      cell: ({ row }) => (
        <div className="font-medium max-w-[300px] truncate">
          {row.original.caption || "No caption"}
        </div>
      ),
      filterFn: captionFilterFn,
    },
    {
      accessorKey: "media_type",
      header: "Type",
      cell: ({ row }) => {
        const mimeType = row.original.mime_type || "";
        const type = mimeType.split('/')[0];
        
        return (
          <Badge
            className={cn(
              type === "image" && "bg-blue-500",
              type === "video" && "bg-purple-500",
              "text-primary-foreground"
            )}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "file_size",
      header: "Size",
      cell: ({ row }) => formatFileSize(row.original.file_size || 0),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => {
        return row.original.created_at 
          ? new Date(row.original.created_at).toLocaleDateString() 
          : "Unknown";
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onMediaClick(row.original)}>
              <Search className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setItemToDelete(row.original.id);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Options</AlertDialogTitle>
                  <AlertDialogDescription>
                    Choose where to delete this item from:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-2 py-4">
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant={deleteType === 'database' ? 'default' : 'outline'} 
                      onClick={() => setDeleteType('database')}
                      size="sm"
                      className="w-full"
                    >
                      Database Only
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant={deleteType === 'telegram' ? 'default' : 'outline'} 
                      onClick={() => setDeleteType('telegram')}
                      size="sm"
                      className="w-full"
                    >
                      Telegram Only
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant={deleteType === 'both' ? 'default' : 'outline'} 
                      onClick={() => setDeleteType('both')}
                      size="sm"
                      className="w-full"
                    >
                      Both Database and Telegram
                    </Button>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      if (row.original.id) {
                        deleteItem(row.original.id, deleteType);
                      }
                    }}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [onMediaClick, deleteItem, deleteType]);

  // Initialize the table
  const table = useReactTable({
    data: messages,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Set the table ref
  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  // Apply search filter
  useEffect(() => {
    if (!searchQuery) {
      setColumnFilters(prev => prev.filter(filter => filter.id !== "caption"));
      return;
    }
    
    setColumnFilters(prev => {
      const existingFilterIndex = prev.findIndex(filter => filter.id === "caption");
      if (existingFilterIndex >= 0) {
        const newFilters = [...prev];
        newFilters[existingFilterIndex] = { id: "caption", value: searchQuery };
        return newFilters;
      } 
      return [...prev, { id: "caption", value: searchQuery }];
    });
  }, [searchQuery]);

  const hasSelectedRows = table.getFilteredSelectedRowModel().rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by caption..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2 lg:px-3">
                <ChevronDown className="ml-1 h-4 w-4" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllColumns()
                .filter(column => column.getCanHide())
                .map(column => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id.charAt(0).toUpperCase() + column.id.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {hasSelectedRows && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-9">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Options</AlertDialogTitle>
                  <AlertDialogDescription>
                    Choose where to delete the selected {table.getFilteredSelectedRowModel().rows.length} item(s) from:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-2 py-4">
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant={deleteType === 'database' ? 'default' : 'outline'} 
                      onClick={() => setDeleteType('database')}
                      size="sm"
                      className="w-full"
                    >
                      Database Only
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant={deleteType === 'telegram' ? 'default' : 'outline'} 
                      onClick={() => setDeleteType('telegram')}
                      size="sm"
                      className="w-full"
                    >
                      Telegram Only
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant={deleteType === 'both' ? 'default' : 'outline'} 
                      onClick={() => setDeleteType('both')}
                      size="sm"
                      className="w-full"
                    >
                      Both Database and Telegram
                    </Button>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleBulkDelete(deleteType)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-4 py-2">
                    {header.isPlaceholder
                      ? null
                      : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            "flex items-center gap-2 cursor-pointer select-none",
                            header.column.getIsSorted() && "text-primary font-medium"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      className="px-4 py-2"
                      onClick={(e) => {
                        // Prevent propagation for checkbox and actions cells
                        if (cell.column.id === "select" || cell.column.id === "actions") {
                          e.stopPropagation();
                        } else {
                          // Only open media viewer for non-action cells
                          onMediaClick(row.original);
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <select
              className="h-8 w-[70px] rounded-md border border-input bg-transparent px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={table.getState().pagination.pageSize}
              onChange={e => {
                table.setPageSize(Number(e.target.value));
              }}
            >
              {[10, 20, 30, 40, 50].map(pageSize => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {"<"}
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {">"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 