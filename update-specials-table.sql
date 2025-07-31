-- Update specials table to include new fields
-- First, drop the old SpecialsColes table if it exists
DROP TABLE IF EXISTS "SpecialsColes" CASCADE;

-- Update the specials table to include new fields
ALTER TABLE "specials" 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS catalogue_date DATE;

-- Update existing data to have some sample categories and prices
UPDATE "specials" SET 
  category = CASE 
    WHEN item ILIKE '%milk%' OR item ILIKE '%yogurt%' OR item ILIKE '%cheese%' THEN 'Dairy'
    WHEN item ILIKE '%bread%' OR item ILIKE '%pasta%' OR item ILIKE '%rice%' THEN 'Pantry'
    WHEN item ILIKE '%eggs%' THEN 'Dairy'
    WHEN item ILIKE '%oil%' THEN 'Pantry'
    WHEN item ILIKE '%tomatoes%' OR item ILIKE '%onions%' THEN 'Produce'
    ELSE 'Other'
  END,
  price = CASE 
    WHEN item ILIKE '%milk%' THEN 3.50
    WHEN item ILIKE '%bread%' THEN 2.50
    WHEN item ILIKE '%eggs%' THEN 4.00
    WHEN item ILIKE '%cheese%' THEN 6.00
    WHEN item ILIKE '%yogurt%' THEN 4.50
    WHEN item ILIKE '%pasta%' THEN 1.50
    WHEN item ILIKE '%rice%' THEN 3.00
    WHEN item ILIKE '%oil%' THEN 8.00
    WHEN item ILIKE '%tomatoes%' THEN 2.00
    WHEN item ILIKE '%onions%' THEN 1.50
    ELSE 5.00
  END,
  discount = CASE 
    WHEN item ILIKE '%milk%' THEN 1.00
    WHEN item ILIKE '%bread%' THEN 0.50
    WHEN item ILIKE '%eggs%' THEN 1.00
    WHEN item ILIKE '%cheese%' THEN 2.00
    WHEN item ILIKE '%yogurt%' THEN 1.50
    WHEN item ILIKE '%pasta%' THEN 0.50
    WHEN item ILIKE '%rice%' THEN 1.00
    WHEN item ILIKE '%oil%' THEN 2.00
    WHEN item ILIKE '%tomatoes%' THEN 0.50
    WHEN item ILIKE '%onions%' THEN 0.50
    ELSE 1.00
  END,
  catalogue_date = CURRENT_DATE - INTERVAL '7 days';

-- Show the updated table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'specials' 
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM "specials" LIMIT 5; 