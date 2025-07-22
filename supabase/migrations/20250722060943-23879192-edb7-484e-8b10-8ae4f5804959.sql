
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

-- Add Row Level Security (RLS) to Staples table
ALTER TABLE "Staples" ENABLE ROW LEVEL SECURITY;

-- Create policies for Staples table
CREATE POLICY "Users can view their own staples" 
ON "Staples" 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own staples" 
ON "Staples" 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own staples" 
ON "Staples" 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own staples" 
ON "Staples" 
FOR DELETE 
USING (auth.uid() = user_id);
