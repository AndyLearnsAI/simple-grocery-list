
-- Add Row Level Security (RLS) to Purchase history table
ALTER TABLE "Purchase history" ENABLE ROW LEVEL SECURITY;

-- Create policies for Purchase history table
CREATE POLICY "Users can view their own purchase history" 
ON "Purchase history" 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own purchase history" 
ON "Purchase history" 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchase history" 
ON "Purchase history" 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own purchase history" 
ON "Purchase history" 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add Row Level Security (RLS) to SavedlistItems table
ALTER TABLE "SavedlistItems" ENABLE ROW LEVEL SECURITY;

-- Create policies for SavedlistItems table
CREATE POLICY "Users can view their own saved list items" 
ON "SavedlistItems" 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved list items" 
ON "SavedlistItems" 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved list items" 
ON "SavedlistItems" 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved list items" 
ON "SavedlistItems" 
FOR DELETE 
USING (auth.uid() = user_id);
