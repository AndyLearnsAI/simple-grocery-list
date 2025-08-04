-- Update specials table with sample data that matches the flyer format
DELETE FROM "specials";

INSERT INTO "specials" (item, quantity, category, price, discount, catalogue_date, on_special, img) VALUES
  ('Continental Cup a Soup Classic Asian Laksa', 1, 'Pantry', 1.40, 'Was $2.80, save $1.40', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Continental Cup a Soup Creamy Chicken', 1, 'Pantry', 1.40, 'Was $2.80, save $1.40', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Continental Pasta & Sauce Macaroni Cheese', 1, 'Pantry', 1.50, 'Was $3.00, save $1.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Continental Pasta & Sauce Bacon Carbonara', 1, 'Pantry', 1.50, 'Was $3.00, save $1.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Maggi 2 Minute Noodles Beef 5 Pack', 1, 'Pantry', 2.50, 'Was $5.00, save $2.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Maggi 2 Minute Noodles Chicken 5 Pack', 1, 'Pantry', 2.50, 'Was $5.00, save $2.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Golden Bakery Crumpets 6 Pack', 1, 'Bakery', 2.30, 'Was $4.60, save $2.30', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Kellogg''s Nutri Grain Cereal 290g', 1, 'Breakfast', 3.50, 'Was $7.00, save $3.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Kellogg''s Special K Original Cereal 300g', 1, 'Breakfast', 3.50, 'Was $7.00, save $3.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Kellogg''s Nutri Grain Bars 12 Pack', 1, 'Snacks', 3.75, 'Was $7.50, save $3.75', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Kellogg''s LCMs Choc Chip 12 Pack', 1, 'Snacks', 3.75, 'Was $7.50, save $3.75', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Nescafé Espresso Coffee Concentrate 500mL', 1, 'Beverages', 5.50, 'Was $11.00, save $5.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Twinings Pure Green Tea 80 Pack', 1, 'Beverages', 6.75, 'Was $13.50, save $6.75', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Twinings English Breakfast Tea 100 Pack', 1, 'Beverages', 6.75, 'Was $13.50, save $6.75', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Sunrice Brown Rice 5kg', 1, 'Pantry', 9.50, 'Was $19.00, save $9.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Sunrice Medium Grain Rice 5kg', 1, 'Pantry', 9.50, 'Was $19.00, save $9.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Coles Brand Milk 2L', 1, 'Dairy', 3.50, 'Was $4.50, save $1.00', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg'),
  ('Coles Brand Bread', 2, 'Bakery', 2.50, 'Was $3.00, save $0.50', CURRENT_DATE - INTERVAL '7 days', true, '/placeholder.svg');

-- Update the types to include the new column
COMMENT ON COLUMN "specials".on_special IS 'Whether the item is currently on special/discount';

-- Show the updated table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'specials' 
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM "specials" LIMIT 5; 