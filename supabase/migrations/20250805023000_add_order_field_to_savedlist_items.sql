-- Add order field to SavedlistItems table
ALTER TABLE "SavedlistItems" ADD COLUMN "order" INTEGER;

-- Set initial order values based on creation date (newest first)
UPDATE "SavedlistItems" 
SET "order" = subquery.row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_number
  FROM "SavedlistItems"
) as subquery
WHERE "SavedlistItems".id = subquery.id;

-- Make order field NOT NULL after setting initial values
ALTER TABLE "SavedlistItems" ALTER COLUMN "order" SET NOT NULL;

-- Add unique constraint per user (similar to grocery list)
ALTER TABLE "SavedlistItems" ADD CONSTRAINT "SavedlistItems_order_user_id_key" UNIQUE ("order", "user_id"); 