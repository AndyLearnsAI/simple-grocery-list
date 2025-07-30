-- Remove the unique constraint on the Item column in Purchase history table
-- This allows multiple entries for the same item with different last_bought dates
ALTER TABLE "Purchase history" DROP CONSTRAINT IF EXISTS "Purchase history_Item_key"; 