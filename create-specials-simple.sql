-- Create a simple test table
DROP TABLE IF EXISTS "specials" CASCADE;

CREATE TABLE "specials" (
  id BIGSERIAL PRIMARY KEY,
  item TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  price DECIMAL(10,2),
  discount TEXT,
  catalogue_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "specials" ENABLE ROW LEVEL SECURITY;

-- Create public read policy
CREATE POLICY "Anyone can view specials items" 
ON "specials" 
FOR SELECT 
USING (true);

-- Insert sample data with categories, prices, and discounts
INSERT INTO "specials" (item, quantity, category, price, discount, catalogue_date) VALUES
  ('Coles Brand Milk 2L', 1, 'Dairy', 3.50, 'Was $4.50, save $1.00', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Bread', 2, 'Pantry', 2.50, 'Was $3.00, save $0.50', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Eggs 12pk', 1, 'Dairy', 4.00, 'Was $5.00, save $1.00', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Cheese 500g', 1, 'Dairy', 6.00, 'Was $8.00, save $2.00', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Yogurt 1kg', 1, 'Dairy', 4.50, 'Was $6.00, save $1.50', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Pasta 500g', 2, 'Pantry', 1.50, 'Was $2.00, save $0.50', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Rice 1kg', 1, 'Pantry', 3.00, 'Was $4.00, save $1.00', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Olive Oil 750ml', 1, 'Pantry', 8.00, 'Was $10.00, save $2.00', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Tomatoes 400g', 2, 'Produce', 2.00, 'Was $2.50, save $0.50', CURRENT_DATE - INTERVAL '7 days'),
  ('Coles Brand Onions 1kg', 1, 'Produce', 1.50, 'Was $2.00, save $0.50', CURRENT_DATE - INTERVAL '7 days');

-- Test the table
SELECT * FROM "specials"; 