-- Add on_special column to specials table
ALTER TABLE "specials" ADD COLUMN IF NOT EXISTS on_special BOOLEAN DEFAULT false;

-- Update existing data to set on_special based on whether there's a discount
UPDATE "specials" 
SET on_special = true 
WHERE discount IS NOT NULL AND discount != '';

-- Update the types to include the new column
COMMENT ON COLUMN "specials".on_special IS 'Whether the item is currently on special/discount'; 