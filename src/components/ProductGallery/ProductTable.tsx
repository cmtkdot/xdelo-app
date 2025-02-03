import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MediaItem } from "@/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, RotateCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProductTableProps {
  mediaGroups: { [key: string]: MediaItem[] };
  onEdit: (media: MediaItem) => void;
}

export const ProductTable = ({ mediaGroups, onEdit }: ProductTableProps) => {
  const { toast } = useToast();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  const formatProductCode = (code?: string) => {
    if (!code) return 'N/A';
    return code.startsWith('PO#') ? code : `PO#${code}`;
  };

  const handleDelete = async (mainMedia: MediaItem) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('media_group_id', mainMedia.media_group_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product group deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting product group:", error);
      toast({
        title: "Error",
        description: "Failed to delete product group",
        variant: "destructive",
      });
    }
  };

  const handleReanalyze = async (mainMedia: MediaItem) => {
    try {
      const { error } = await supabase.functions.invoke('reanalyze-low-confidence', {
        body: {
          message_id: mainMedia.id,
          caption: mainMedia.caption,
          analyzed_content: mainMedia.analyzed_content
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reanalysis started",
      });
    } catch (error) {
      console.error("Error triggering reanalysis:", error);
      toast({
        title: "Error",
        description: "Failed to start reanalysis",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead>Product Code</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Purchase Date</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.values(mediaGroups).map((group) => {
            const mainMedia = group.find(media => media.is_original_caption) || group[0];
            const analyzedContent = mainMedia.analyzed_content;
            const hasError = mainMedia.processing_state === 'error';

            return (
              <TableRow key={mainMedia.id}>
                <TableCell>{analyzedContent?.product_name || 'Untitled Product'}</TableCell>
                <TableCell>{formatProductCode(analyzedContent?.product_code)}</TableCell>
                <TableCell>{analyzedContent?.vendor_uid || 'N/A'}</TableCell>
                <TableCell>{formatDate(analyzedContent?.purchase_date)}</TableCell>
                <TableCell>{analyzedContent?.quantity || 'N/A'}</TableCell>
                <TableCell>{analyzedContent?.notes || 'N/A'}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    hasError ? 'bg-red-100 text-red-800' : 
                    mainMedia.processing_state === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {mainMedia.processing_state || 'pending'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(mainMedia)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReanalyze(mainMedia)}
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(mainMedia)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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