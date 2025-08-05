-- Fix order to be unique per user_id
-- First, update existing items to have order based on created_at per user
UPDATE "Grocery list" 
SET "order" = (
  SELECT position 
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as position 
    FROM "Grocery list"
  ) ranked 
  WHERE ranked.id = "Grocery list".id
);

-- Add unique constraint on (user_id, order) to ensure each user has their own ordering
-- First, drop the existing index if it exists
DROP INDEX IF EXISTS idx_grocery_list_order;

-- Create a composite unique index on user_id and order
CREATE UNIQUE INDEX idx_grocery_list_user_order ON "Grocery list" (user_id, "order");

-- Also create a regular index on order for performance
CREATE INDEX idx_grocery_list_order ON "Grocery list" ("order");
