# Buy Later Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the main grocery list into a headerless Default section and a separate "Buy Later" section, with a toggle button in the item popup to move items between them.

**Architecture:** A single `buy_later` boolean column on the `Grocery list` table drives everything. The existing `items` array is filtered by search then split into two rendered groups by `buy_later`. Cross-section moves happen only via a toggle button in `ItemDetailModal`; drag-reorder stays within a section by replacing that section's slots inside the global `items` array and renumbering the shared `order` column.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase JS client, Tailwind, shadcn/ui, lucide-react icons.

## Global Constraints

- No unit-test runner exists in this repo. Each task's verification gate is `npm run lint` (expect no new errors) + `npm run build` (expect success) + the manual check described in the task.
- Never exceed AI model name changes — N/A here.
- New items, undo/restore inserts, and saved/specials additions must default to `buy_later = false` (DB default handles this; do not set it explicitly on insert).
- The `order` column is a single global sequence shared by both sections. Do not add a per-section order column.
- The toggle button in the popup must keep the modal open and show an active (checked/colored) state.

---

### Task 1: Add `buy_later` column and update types

**Files:**
- Create: `supabase/migrations/20260626000000_add_buy_later_field.sql`
- Modify: `src/integrations/supabase/types.ts` (the `"Grocery list"` `Row` / `Insert` / `Update` blocks, around lines 18-60)

**Interfaces:**
- Produces: a `buy_later: boolean` field (Row), `buy_later?: boolean` (Insert/Update) on the `Grocery list` table type, consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260626000000_add_buy_later_field.sql`:

```sql
-- Add buy_later flag to Grocery list table for the "Buy Later" section
ALTER TABLE "Grocery list"
ADD COLUMN IF NOT EXISTS buy_later BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Add `buy_later` to the Row type**

In `src/integrations/supabase/types.ts`, inside `"Grocery list"` → `Row`, add after the `auto_icon: string | null` line:

```ts
          buy_later: boolean
```

- [ ] **Step 3: Add `buy_later` to the Insert type**

Inside `"Grocery list"` → `Insert`, add after the `auto_icon?: string | null` line:

```ts
          buy_later?: boolean
```

- [ ] **Step 4: Add `buy_later` to the Update type**

Inside `"Grocery list"` → `Update`, add after its `auto_icon?: string | null` line:

```ts
          buy_later?: boolean
```

- [ ] **Step 5: Apply the migration**

Run the migration against the Supabase project (via the Supabase SQL editor or `supabase db push`, depending on the workflow). If applied manually, paste the SQL from Step 1.
Expected: column `buy_later` exists on `Grocery list`, defaulting to `false`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors about `buy_later`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260626000000_add_buy_later_field.sql src/integrations/supabase/types.ts
git commit -m "Add buy_later column to Grocery list table"
```

---

### Task 2: Split list view into Default and Buy Later sections

**Files:**
- Modify: `src/components/GroceryChecklist.tsx`

**Interfaces:**
- Consumes: `buy_later` field from Task 1.
- Produces: `toggleBuyLater(id: number)` (used internally), section-aware reorder via `handleReorder(sectionItems: GroceryItem[], fromIndex: number, toIndex: number)`. Two rendered groups: `defaultItems` and `buyLaterItems` derived from `filteredItems`.

- [ ] **Step 1: Add `buy_later` to the `GroceryItem` interface**

In `src/components/GroceryChecklist.tsx`, in the `interface GroceryItem` block (around line 20), add after `order: number;`:

```ts
  buy_later?: boolean;
```

- [ ] **Step 2: Add the `toggleBuyLater` handler**

Add this handler inside the `GroceryChecklist` component, next to `toggleItem` (after the `toggleItem` function, around line 562):

```ts
  const toggleBuyLater = async (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const next = !item.buy_later;
    setItems(prev => prev.map(i => (i.id === id ? { ...i, buy_later: next } : i)));
    try {
      const { error } = await supabase
        .from('Grocery list')
        .update({ buy_later: next })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      setItems(prev => prev.map(i => (i.id === id ? { ...i, buy_later: !next } : i)));
      toast({
        title: "Error",
        description: "Failed to update Buy Later status",
        variant: "destructive",
      });
    }
  };
```

- [ ] **Step 3: Replace `reorderItems` with a section-aware `handleReorder`**

Replace the existing `reorderItems` function (around lines 494-513) with:

```ts
  const handleReorder = async (sectionItems: GroceryItem[], fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    try {
      const reordered = [...sectionItems];
      const [movedItem] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedItem);
      // Replace this section's slots inside the full items array in place,
      // leaving the other section's items where they are, then renumber order.
      const sectionIds = new Set(sectionItems.map(i => i.id));
      let pointer = 0;
      const newItems = items.map(it => (sectionIds.has(it.id) ? reordered[pointer++] : it));
      const updatedItems = newItems.map((item, index) => ({ ...item, order: index + 1 }));
      setItems(updatedItems);
      await updateItemsOrder(updatedItems);
    } catch (error) {
      toast({
        title: "Error reordering",
        description: "Failed to reorder items",
        variant: "destructive",
      });
    }
  };
```

- [ ] **Step 4: Derive the two section groups**

Find the `filteredItems` definition (around line 1336) and add the two groups right after it:

```ts
  const filteredItems = items.filter(item =>
    item.Item.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const defaultItems = filteredItems.filter(item => !item.buy_later);
  const buyLaterItems = filteredItems.filter(item => item.buy_later);
```

- [ ] **Step 5: Render the Default group**

Replace the list-rendering block. Find the `<div className={`space-y-0 ${isSorting ...`}>` block (around line 1428) that maps `filteredItems`. Replace the `filteredItems.map(...)` call and its `filteredItems.length === 0` empty state with the Default group:

```tsx
            {defaultItems.map((item, index) => (
              <TouchSortableGroceryItem
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                onReorder={(from, to) => handleReorder(defaultItems, from, to)}
                onImageClick={() => setDetailModalItem(item)}
                index={index}
                totalItems={defaultItems.length}
                dragDestination={dragDestination}
                onDragDestinationChange={setDragDestination}
              />
            ))}
            {defaultItems.length === 0 && (
              <div className="p-6 text-center">
                <div className="text-muted-foreground">
                  {searchTerm
                    ? `No items found matching "${searchTerm}". Try a different search term.`
                    : "Your grocery list is empty. Add some items to get started!"
                  }
                </div>
              </div>
            )}
```

- [ ] **Step 6: Render the Buy Later section**

Immediately after the Default group's closing (after the bottom Add bar `</div>` that ends the `space-y-0` list container, around line 1472, just before the closing of the first `<Card>`), add the Buy Later section. Place it as a sibling block inside the same `space-y-4` wrapper, after the first `</Card>` (around line 1474) and before the second `<Card>`:

```tsx
      <Card className="px-0 py-4 shadow-card">
        <div className="space-y-0 px-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Buy Later</h3>
          <div className={`space-y-0 ${isSorting ? 'blur-sm pointer-events-none' : ''}`}>
            {buyLaterItems.map((item, index) => (
              <TouchSortableGroceryItem
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                onReorder={(from, to) => handleReorder(buyLaterItems, from, to)}
                onImageClick={() => setDetailModalItem(item)}
                index={index}
                totalItems={buyLaterItems.length}
                dragDestination={dragDestination}
                onDragDestinationChange={setDragDestination}
              />
            ))}
            {buyLaterItems.length === 0 && (
              <div className="py-4 text-center">
                <div className="text-sm text-muted-foreground">Nothing here yet</div>
              </div>
            )}
          </div>
        </div>
      </Card>
```

Note: the `TouchSortableGroceryItem` `Card` has horizontal padding `px-0`; the section wrapper uses `px-4` so the header and items align with the rest of the layout.

- [ ] **Step 7: Verify lint and build**

Run: `npm run lint`
Expected: no new errors referencing `GroceryChecklist.tsx`.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Manual check**

Run: `npm run dev`, open the app, sign in. In the browser console (or via Supabase) set one item's `buy_later` to true, reload.
Expected: that item appears under the "Buy Later" header; others stay in the headerless top list. Drag-reordering inside the top list does not move the Buy Later item. Search matches items in both sections.

- [ ] **Step 9: Commit**

```bash
git add src/components/GroceryChecklist.tsx
git commit -m "Split grocery list into Default and Buy Later sections"
```

---

### Task 3: Add Buy Later toggle button to the item popup

**Files:**
- Modify: `src/components/ItemDetailModal.tsx`

**Interfaces:**
- Consumes: `buy_later` field from Task 1; the `onUpdate` callback re-fetches list state so the section split (Task 2) reflects the change.

- [ ] **Step 1: Add `buy_later` to the modal's item prop type**

In `src/components/ItemDetailModal.tsx`, in the `item:` object inside `ItemDetailModalProps` (around lines 14-24), add after `link?: string | null;`:

```ts
    buy_later?: boolean;
```

- [ ] **Step 2: Import the check icon**

Update the lucide import (line 8) to include `Check`:

```ts
import { Edit3, Trash2, Link, Check } from "lucide-react";
```

- [ ] **Step 3: Track buy_later in local state**

Add a state hook next to the other `useState` calls (around line 36):

```ts
  const [buyLater, setBuyLater] = useState(!!item.buy_later);
```

And reset it in the existing `useEffect([item])` (around lines 40-48), after `setNameValue(item.Item);`:

```ts
    setBuyLater(!!item.buy_later);
```

- [ ] **Step 4: Add the toggle handler**

Add this function inside the component, after `handleDelete` (around line 240):

```ts
  const handleToggleBuyLater = async () => {
    const next = !buyLater;
    setBuyLater(next);
    try {
      const { error } = await supabase
        .from('Grocery list')
        .update({ buy_later: next })
        .eq('id', item.id);
      if (error) throw error;
      toast({
        title: next ? "Moved to Buy Later" : "Moved to list",
        description: `${item.Item} ${next ? "added to Buy Later" : "moved back to your list"}.`,
      });
      onUpdate();
    } catch (e) {
      setBuyLater(!next);
      const message = e instanceof Error ? e.message : 'Failed to update Buy Later';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };
```

- [ ] **Step 5: Render the toggle button**

In the action-buttons row (around lines 427-431), add the toggle button — only for the `Grocery list` table. Replace the action row with:

```tsx
        {/* Action Buttons */}
        <div className="flex gap-2 justify-end mt-4">
          {tableName === 'Grocery list' && (
            <Button
              variant={buyLater ? "default" : "outline"}
              onClick={handleToggleBuyLater}
              className={`gap-2 mr-auto ${buyLater ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
              title={buyLater ? "Remove from Buy Later" : "Move to Buy Later"}
            >
              {buyLater && <Check className="h-4 w-4" />}
              Buy Later
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} className="gap-2"><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button onClick={handleUpdate}>Update</Button>
        </div>
```

- [ ] **Step 6: Verify lint and build**

Run: `npm run lint`
Expected: no new errors referencing `ItemDetailModal.tsx`.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual check**

Run: `npm run dev`, open the app. Tap an item's image to open the popup, tap "Buy Later".
Expected: the button turns green with a check and stays visible (modal stays open). Behind the modal the item moves to the Buy Later section. Tapping again turns it back to outline and moves the item to the top list. Closing and reopening the app preserves the state.

- [ ] **Step 8: Commit**

```bash
git add src/components/ItemDetailModal.tsx
git commit -m "Add Buy Later toggle button to item popup"
```

---

## Self-Review Notes

- **Spec coverage:** Migration + types (Task 1) → data model. Section split, always-visible Buy Later header with empty placeholder, search/sort across both, per-section reorder, `toggleBuyLater` (Task 2) → list view. Popup toggle with active state that keeps the modal open (Task 3) → item popup. Default section stays headerless (Task 2, Step 5 has no header). All spec sections covered.
- **Defaults:** No insert path sets `buy_later`, so the DB default `false` applies to new/undo/saved/specials items — satisfies the constraint.
- **Type consistency:** `handleReorder(sectionItems, fromIndex, toIndex)` is referenced consistently in Task 2 Steps 5 & 6; `toggleBuyLater`/`handleToggleBuyLater` are distinct (list view vs modal) by design.
