-- Add auto_icon field to Grocery list table
ALTER TABLE "Grocery list"
ADD COLUMN IF NOT EXISTS auto_icon TEXT;

-- Add auto_icon field to SavedlistItems table
ALTER TABLE "SavedlistItems"
ADD COLUMN IF NOT EXISTS auto_icon TEXT;