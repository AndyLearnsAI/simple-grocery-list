-- Add discount_percentage field to Grocery list table
ALTER TABLE "Grocery list"
ADD COLUMN IF NOT EXISTS discount_percentage TEXT;

-- Add discount_percentage field to SavedlistItems table
ALTER TABLE "SavedlistItems"
ADD COLUMN IF NOT EXISTS discount_percentage TEXT;