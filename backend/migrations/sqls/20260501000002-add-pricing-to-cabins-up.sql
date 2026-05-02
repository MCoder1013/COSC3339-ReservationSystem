-- Add price column to cabins table
ALTER TABLE cabins
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
