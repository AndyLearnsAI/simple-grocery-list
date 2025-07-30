-- Check if SpecialsColes table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'SpecialsColes'
) as table_exists;

-- If the table doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'SpecialsColes'
  ) THEN
    -- Create the table
    CREATE TABLE "SpecialsColes" (
      id BIGSERIAL PRIMARY KEY,
      Item TEXT NOT NULL,
      Quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE "SpecialsColes" ENABLE ROW LEVEL SECURITY;

    -- Create public read policy
    CREATE POLICY "Anyone can view specials items" 
    ON "SpecialsColes" 
    FOR SELECT 
    USING (true);

    -- Insert sample data
    INSERT INTO "SpecialsColes" (Item, Quantity) VALUES
      ('Coles Brand Milk 2L', 1),
      ('Coles Brand Bread', 2),
      ('Coles Brand Eggs 12pk', 1),
      ('Coles Brand Cheese 500g', 1),
      ('Coles Brand Yogurt 1kg', 1),
      ('Coles Brand Pasta 500g', 2),
      ('Coles Brand Rice 1kg', 1),
      ('Coles Brand Olive Oil 750ml', 1),
      ('Coles Brand Tomatoes 400g', 2),
      ('Coles Brand Onions 1kg', 1),
      ('Coles Brand Bananas 1kg', 1),
      ('Coles Brand Apples 1kg', 1),
      ('Coles Brand Potatoes 2kg', 1),
      ('Coles Brand Carrots 1kg', 1),
      ('Coles Brand Broccoli', 2);

    RAISE NOTICE 'SpecialsColes table created successfully with sample data';
  ELSE
    RAISE NOTICE 'SpecialsColes table already exists';
  END IF;
END $$;

-- Show the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'SpecialsColes'
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM "SpecialsColes" LIMIT 5; 