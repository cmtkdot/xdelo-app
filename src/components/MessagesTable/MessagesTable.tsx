
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableRow, MessagesTableProps } from "./types";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const MessagesTable = ({ data, isLoading, onUpdate, onDelete }: MessagesTableProps) => {
  const [editableRows, setEditableRows] = useState<Record<string, EditableRow>>({});

  const handleEdit = (id: string) => {
    const row = data.find((item) => item.id === id);
    if (row) {
      setEditableRows((prev) => ({
        ...prev,
        [id]: {
          ...row,
          isEditing: true,
        },
      }));
    }
  };

  const handleCancelEdit = (id: string) => {
    setEditableRows((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const handleSave = async (id: string) => {
    const editedRow = editableRows[id];
    if (!editedRow) return;

    try {
      const updatedData = {
        caption: editedRow.caption,
        analyzed_content: {
          ...(editedRow.analyzed_content || {}),
          product_name: editedRow.analyzed_content?.product_name,
          vendor_uid: editedRow.analyzed_content?.vendor_uid,
          quantity: editedRow.analyzed_content?.quantity,
        }
      };

      await onUpdate(id, updatedData);
      setEditableRows((prev) => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      toast.success("Row updated successfully");
    } catch (error) {
      toast.error("Failed to update row");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast.success("Row deleted successfully");
    } catch (error) {
      toast.error("Failed to delete row");
    }
  };

  const handleInputChange = (id: string, field: string, value: string) => {
    setEditableRows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        analyzed_content: {
          ...prev[id].analyzed_content,
          [field]: value,
        },
      },
    }));
  };

  const handleCaptionChange = (id: string, value: string) => {
    setEditableRows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        caption: value,
      },
    }));
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Caption</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const isEditing = editableRows[row.id]?.isEditing;

            return (
              <TableRow key={row.id}>
                <TableCell className="max-w-[300px]">
                  {isEditing ? (
                    <Input
                      value={editableRows[row.id]?.caption || ""}
                      onChange={(e) => handleCaptionChange(row.id, e.target.value)}
                    />
                  ) : (
                    <span className="line-clamp-2">{row.caption}</span>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editableRows[row.id]?.analyzed_content?.product_name || ""}
                      onChange={(e) => handleInputChange(row.id, "product_name", e.target.value)}
                    />
                  ) : (
                    row.analyzed_content?.product_name
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editableRows[row.id]?.analyzed_content?.vendor_uid || ""}
                      onChange={(e) => handleInputChange(row.id, "vendor_uid", e.target.value)}
                    />
                  ) : (
                    row.analyzed_content?.vendor_uid
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editableRows[row.id]?.analyzed_content?.quantity?.toString() || ""}
                      onChange={(e) => handleInputChange(row.id, "quantity", e.target.value)}
                      type="number"
                    />
                  ) : (
                    row.analyzed_content?.quantity
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSave(row.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancelEdit(row.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(row.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(row.id)}
                          className={cn("text-destructive")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
