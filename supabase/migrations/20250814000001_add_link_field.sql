-- Add link field to Grocery list table
ALTER TABLE "Grocery list"
ADD COLUMN IF NOT EXISTS link TEXT;

-- Add link field to SavedlistItems table
ALTER TABLE "SavedlistItems"
ADD COLUMN IF NOT EXISTS link TEXT;

-- Add link field to specials table
ALTER TABLE "specials"
ADD COLUMN IF NOT EXISTS link TEXT;