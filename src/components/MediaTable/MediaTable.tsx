import { useState, useMemo, useEffect } from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MediaViewer } from "@/components/ui/media-viewer"
import { Edit2, Save, X, ArrowUpDown, Search, ExternalLink } from "lucide-react"
import { MediaEditDialog } from "@/components/MediaEditDialog/MediaEditDialog"
import { isVideoMessage, getVideoDuration, getTelegramMessageUrl } from "@/utils/mediaUtils"
import { useToast } from "@/hooks/useToast"
import { Message } from "@/types/entities/Message"
import { format } from "date-fns"

interface MediaTableProps {
  messages: Message[]
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function MediaTable({ messages }: MediaTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([])
  const { toast } = useToast()

  const handleMediaClick = (message: Message) => {
    if (message.media_group_id) {
      const groupMedia = messages.filter(m => m.media_group_id === message.media_group_id)
      setSelectedMedia(groupMedia)
    } else {
      setSelectedMedia([message])
    }
    setIsViewerOpen(true)
  }

  const handleEditClick = (message: Message) => {
    setEditingMessage(message)
    setIsEditDialogOpen(true)
  }

  const handleEditSuccess = () => {
    toast({
      description: "Media updated successfully. Changes are synced to Telegram.",
      variant: "default"
    })
  }

  const columns = useMemo<ColumnDef<Message>[]>(() => [
    {
      id: "preview",
      header: "Preview",
      cell: ({ row }) => {
        const message = row.original
        const mimeType = message.mime_type || ""
        const isVideo = isVideoMessage(message)
        const videoDuration = getVideoDuration(message)

        return (
          <div 
            className="relative w-20 h-20 rounded cursor-pointer overflow-hidden"
            onClick={() => handleMediaClick(message)}
          >
            {isVideo ? (
              <>
                <div className="relative w-full h-full">
                  <video
                    src={message.public_url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="rounded-full bg-white/90 w-8 h-8 flex items-center justify-center">
                      <svg className="h-4 w-4 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                    </div>
                  </div>
                  {videoDuration && (
                    <Badge variant="secondary" className="absolute bottom-1 right-1 text-xs">
                      {formatDuration(videoDuration)}
                    </Badge>
                  )}
                </div>
              </>
            ) : mimeType.startsWith("image/") ? (
              <img 
                src={message.public_url} 
                alt={message.caption || "Preview"} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-500">File</span>
              </div>
            )}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: "product_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1"
          >
            Product
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const message = row.original
        return (
          <div className="max-w-[200px] truncate">
            {message.analyzed_content?.product_name || "—"}
          </div>
        )
      },
    },
    {
      accessorKey: "purchase_order",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1"
          >
            PO UID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const message = row.original
        return <div>{message.purchase_order || "—"}</div>
      },
    },
    {
      accessorKey: "analyzed_content.purchase_date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1"
          >
            Purchase Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const message = row.original
        const purchaseDate = message.analyzed_content?.purchase_date
        return (
          <div>
            {purchaseDate ? format(new Date(purchaseDate), "MMM d, yyyy") : "—"}
          </div>
        )
      },
    },
    {
      accessorKey: "vendor_uid",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1"
          >
            Vendor
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const message = row.original
        return <div>{message.vendor_uid || "—"}</div>
      },
    },
    {
      accessorKey: "notes",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1"
          >
            Notes
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const message = row.original
        return (
          <div className="max-w-[200px] truncate">
            {message.notes || message.caption || "—"}
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const message = row.original
        const messageUrl = getTelegramMessageUrl(message)
        
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                handleEditClick(message)
              }}
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            
            {messageUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(messageUrl, "_blank")
                }}
                title="Open in Telegram"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ], [])

  const table = useReactTable({
    data: messages,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })

  // Handler for global search
  const handleGlobalFilterChange = (value: string) => {
    setGlobalFilter(value)
  }

  // Filter data based on global search
  useEffect(() => {
    table.setGlobalFilter(globalFilter)
  }, [globalFilter, table])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(e) => handleGlobalFilterChange(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
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
                  onClick={() => handleMediaClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id} 
                      className={cell.column.id === "preview" ? "p-2" : ""}
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
          Showing {table.getRowModel().rows.length} of {messages.length} items
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <select
              className="h-8 w-16 rounded-md border border-input bg-background"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value))
              }}
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
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
        </div>
      </div>

      {/* Media viewer for preview */}
      <MediaViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currentGroup={selectedMedia}
      />

      {/* Edit dialog */}
      {editingMessage && (
        <MediaEditDialog
          media={editingMessage}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
} 