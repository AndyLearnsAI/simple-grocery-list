-- Add order field to grocery list table for drag and drop reordering
ALTER TABLE "Grocery list" ADD COLUMN "order" INTEGER;

-- Update existing items to have order based on created_at
UPDATE "Grocery list" 
SET "order" = (
  SELECT position 
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as position 
    FROM "Grocery list"
  ) ranked 
  WHERE ranked.id = "Grocery list".id
);

-- Make order field NOT NULL after populating it
ALTER TABLE "Grocery list" ALTER COLUMN "order" SET NOT NULL;

-- Add index for better performance on ordering
CREATE INDEX idx_grocery_list_order ON "Grocery list" ("order");
