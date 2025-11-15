import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DownloadButtonProps {
  content: string;
  filename: string;
  mimeType?: string;
}

export const DownloadButton = ({ 
  content, 
  filename, 
  mimeType = "text/plain" 
}: DownloadButtonProps) => {
  const { toast } = useToast();

  const handleDownload = () => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: `${filename} downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleDownload}
      className="h-7 gap-1"
    >
      <Download className="w-3 h-3" />
      Download
    </Button>
  );
};
