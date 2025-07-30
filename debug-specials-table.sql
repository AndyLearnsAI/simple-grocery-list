-- Check if the table exists and show its structure
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'specials';

-- Show the table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'specials'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'specials';

-- Show existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'specials';

-- Check if there's any data
SELECT COUNT(*) as row_count FROM "specials";

-- Show sample data
SELECT * FROM "specials" LIMIT 5;

-- If no data exists, insert some
INSERT INTO "specials" (Item, Quantity) VALUES
  ('Coles Brand Milk 2L', 1),
  ('Coles Brand Bread', 2),
  ('Coles Brand Eggs 12pk', 1),
  ('Coles Brand Cheese 500g', 1),
  ('Coles Brand Yogurt 1kg', 1)
ON CONFLICT DO NOTHING;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Anyone can view specials items" ON "specials";

CREATE POLICY "Anyone can view specials items" 
ON "specials" 
FOR SELECT 
USING (true);

-- Test the policy
SELECT * FROM "specials" LIMIT 3; 