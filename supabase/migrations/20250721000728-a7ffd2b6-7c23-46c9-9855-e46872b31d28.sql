-- Add user_id column to grocery list table to associate items with users
ALTER TABLE "Grocery list" ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE "Grocery list" ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own grocery items" 
ON "Grocery list" 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own grocery items" 
ON "Grocery list" 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grocery items" 
ON "Grocery list" 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grocery items" 
ON "Grocery list" 
FOR DELETE 
USING (auth.uid() = user_id);