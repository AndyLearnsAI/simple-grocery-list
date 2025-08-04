import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuantitySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  itemName: string;
  maxQuantity: number;
  actionType: 'purchase' | 'delete' | 'restore' | 'add';
}

export function QuantitySelector({ 
  isOpen, 
  onClose, 
  onConfirm, 
  itemName, 
  maxQuantity, 
  actionType 
}: QuantitySelectorProps) {
  const [selectedQuantity, setSelectedQuantity] = useState(actionType === 'add' ? 1 : maxQuantity);

  useEffect(() => {
    if (isOpen) {
      setSelectedQuantity(actionType === 'add' ? 1 : maxQuantity);
    }
  }, [isOpen, actionType, maxQuantity]);

  const handleConfirm = () => {
    if (selectedQuantity > 0 && selectedQuantity <= maxQuantity) {
      onConfirm(selectedQuantity);
      onClose();
    }
  };

  const getActionText = () => {
    switch (actionType) {
      case 'purchase': return 'mark as purchased';
      case 'restore': return 'restore';
      case 'add': return 'add to list';
      default: return 'process';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Quantity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            How much of "{itemName}" would you like to {getActionText()}?
          </p>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (max: {maxQuantity})</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={maxQuantity}
              value={selectedQuantity}
              onChange={(e) => setSelectedQuantity(Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
