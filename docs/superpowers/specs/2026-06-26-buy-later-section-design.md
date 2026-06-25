# Buy Later Section — Design

**Date:** 2026-06-26
**Status:** Approved (pending spec review)

## Goal

Split the main grocery list view into two sections: a headerless **Default** section at
the top (today's list) and a separate **Buy Later** section below it. Items can be moved
between sections via a toggle button in the item popup (`ItemDetailModal`).

## Data Model

Add a single boolean flag to the `Grocery list` table:

- New migration: `buy_later BOOLEAN NOT NULL DEFAULT false` on `"Grocery list"`.
- Update `src/integrations/supabase/types.ts` (`Row` / `Insert` / `Update`) to include
  `buy_later`.
- New items, undo/restore inserts, and saved/specials additions all default to `false`
  (Default section). The existing global `order` sequence is unchanged — one ordering
  column drives both sections.

## List View (`GroceryChecklist.tsx`)

- The single `items` array is filtered by `searchTerm` as today, then split into two
  groups by `buy_later`:
  - **Default group** (`buy_later === false`) — rendered first, **headerless**, exactly
    as the list looks today.
  - **Buy Later group** (`buy_later === true`) — rendered below with an always-visible
    **"Buy Later"** header. When the group is empty, show a muted placeholder
    (e.g. "Nothing here yet").
- **Search** applies to both groups (existing `filteredItems` logic feeds both).
- **Sort** reassigns the global `order` (existing `sortItems` logic); both sections
  re-render in that order with no per-section sort controls.
- **Drag-reorder is within a section.** `reorderItems` operates on the dragged item's
  section slice; the global `order` values are recomputed so the other section's items
  keep their relative order and are not displaced. Each rendered group passes
  section-relative `index` / `totalItems` to `TouchSortableGroceryItem`.
- New handler `toggleBuyLater(id)`: updates `buy_later` in Supabase and local state.

## Item Popup (`ItemDetailModal.tsx`)

- Add a toggle button to the action row (alongside Cancel / Delete / Update), shown only
  when `tableName === 'Grocery list'`.
- The button reflects current state visually:
  - Default state → outline button labeled **"Buy Later"**.
  - Active state (item is `buy_later`) → filled/colored button with a check icon,
    labeled **"Buy Later"** (or "In Buy Later").
- Tapping toggles `buy_later` immediately (Supabase update + `onUpdate()` + toast). The
  **modal stays open** so the user sees the button's active state change. No navigation
  or close on toggle.
- Local component state tracks the current `buy_later` value so the button updates
  instantly on tap.

## Out of Scope (YAGNI)

- No per-section sort controls.
- No count badges on section headers.
- No separate ordering column per section.
- No drag-between-sections (cross-section moves happen only via the popup button).

## Testing

- Toggling an item in the popup moves it between sections and persists across reload.
- New items, undo, and saved/specials additions land in the Default section.
- Search matches items in both sections; sort orders both.
- Drag-reorder within a section does not move items into the other section or reshuffle
  the other section.
- Empty Buy Later section shows the header with placeholder text.
