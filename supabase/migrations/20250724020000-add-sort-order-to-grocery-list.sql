-- Add sort_order column to grocery list table for drag-and-drop reordering
ALTER TABLE "Grocery list" ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Update existing items to have a sort_order based on their creation time
-- This ensures existing items have a proper order
UPDATE "Grocery list" 
SET sort_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_num
  FROM "Grocery list"
) as subquery
WHERE "Grocery list".id = subquery.id;

-- Make sort_order NOT NULL after setting initial values
ALTER TABLE "Grocery list" ALTER COLUMN sort_order SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN "Grocery list".sort_order IS 'Order of items in the grocery list for drag-and-drop reordering';