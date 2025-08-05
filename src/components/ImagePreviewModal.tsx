import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  itemName: string;
}

export function ImagePreviewModal({ isOpen, onClose, imageUrl, itemName }: ImagePreviewModalProps) {
  if (!imageUrl) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-auto p-0 bg-transparent border-none shadow-none flex items-center justify-center">
        <img src={imageUrl} alt={`Preview of ${itemName}`} className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg" />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
