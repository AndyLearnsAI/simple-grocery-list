import { useState } from "react";
import { SimpleReorder } from "./SimpleReorder";

const testItems = [
  { id: 1, name: "Apple" },
  { id: 2, name: "Banana" },
  { id: 3, name: "Orange" },
  { id: 4, name: "Grape" },
];

export function DragTest() {
  const [items, setItems] = useState(testItems);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const handleReorder = (newItems: typeof testItems) => {
    setItems(newItems);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Simple Reorder Test</h2>
        <button
          className={`px-3 py-1 rounded text-sm ${
            isReorderMode 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary text-secondary-foreground'
          }`}
          onClick={() => setIsReorderMode(!isReorderMode)}
        >
          {isReorderMode ? "Done" : "Reorder"}
        </button>
      </div>
      
      <SimpleReorder
        items={items}
        onReorder={handleReorder}
        isReorderMode={isReorderMode}
      />
      
      <div className="text-xs text-muted-foreground">
        Current order: {items.map(item => item.name).join(' → ')}
      </div>
    </div>
  );
}