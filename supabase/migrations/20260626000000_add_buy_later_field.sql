-- Add buy_later flag to Grocery list table for the "Buy Later" section
ALTER TABLE "Grocery list"
ADD COLUMN IF NOT EXISTS buy_later BOOLEAN NOT NULL DEFAULT false;
