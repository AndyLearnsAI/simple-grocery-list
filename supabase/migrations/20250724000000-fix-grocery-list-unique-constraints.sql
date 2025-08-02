-- Remove unique constraints on the Grocery list table that prevent multiple users from having the same item
-- This allows different users to have the same item name in their grocery lists

-- First, check for existing unique constraints
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Check for unique constraints on the Item column
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'Grocery list'
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name = 'Item';
    
    -- If found, drop it
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "Grocery list" DROP CONSTRAINT IF EXISTS "' || constraint_name || '"';
        RAISE NOTICE 'Dropped unique constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No unique constraint found on Item column';
    END IF;
    
    -- Check for unique constraints on Item + user_id combination
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'Grocery list'
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name IN ('Item', 'user_id');
    
    -- If found, drop it
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "Grocery list" DROP CONSTRAINT IF EXISTS "' || constraint_name || '"';
        RAISE NOTICE 'Dropped unique constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No unique constraint found on Item + user_id combination';
    END IF;
END $$;

-- Add a comment to document this change
COMMENT ON TABLE "Grocery list" IS 'Grocery list items per user - multiple users can have the same item names';

-- Verify the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Grocery list'
ORDER BY ordinal_position; 