-- Create a simple test table
DROP TABLE IF EXISTS "specials" CASCADE;

CREATE TABLE "specials" (
  id BIGSERIAL PRIMARY KEY,
  Item TEXT NOT NULL,
  Quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "specials" ENABLE ROW LEVEL SECURITY;

-- Create public read policy
CREATE POLICY "Anyone can view specials items" 
ON "specials" 
FOR SELECT 
USING (true);

-- Insert sample data
INSERT INTO "specials" (Item, Quantity) VALUES
  ('Coles Brand Milk 2L', 1),
  ('Coles Brand Bread', 2),
  ('Coles Brand Eggs 12pk', 1),
  ('Coles Brand Cheese 500g', 1),
  ('Coles Brand Yogurt 1kg', 1);

-- Test the table
SELECT * FROM "specials"; 