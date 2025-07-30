-- Drop existing SpecialsColes table if it exists
DROP TABLE IF EXISTS "SpecialsColes" CASCADE;

-- Create new SpecialsColes table
CREATE TABLE "SpecialsColes" (
  id BIGSERIAL PRIMARY KEY,
  Item TEXT NOT NULL,
  Quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Row Level Security (RLS) to SpecialsColes table
ALTER TABLE "SpecialsColes" ENABLE ROW LEVEL SECURITY;

-- Create policies for SpecialsColes table - allow public read access
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