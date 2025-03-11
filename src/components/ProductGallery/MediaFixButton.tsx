
import { Button } from "@/components/ui/button";
import { useMediaReprocessing } from "@/hooks/useMediaReprocessing";
import { Wrench } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";

export function MediaFixButton() {
  const { fixContentDisposition, isProcessing } = useMediaReprocessing();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { toast } = useToast();

  const handleFixMediaDisplay = async () => {
    try {
      await fixContentDisposition();
      toast({
        title: "Success",
        description: "Started fixing media files to display inline. This will be applied to new files and redownloaded files."
      });
    } catch (error) {
      console.error("Failed to fix media display:", error);
    }
  };

  return (
    <div className="mb-4">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleFixMediaDisplay}
        disabled={isProcessing}
        title="Fix media files to display in the browser instead of downloading"
      >
        <Wrench className="w-4 h-4 mr-2" />
        {isProcessing ? "Fixing Media..." : "Fix Media Display"}
      </Button>
    </div>
  );
}
