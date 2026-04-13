ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ; -- Add soft delete fields to all the tables
ALTER TABLE resources ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE cabins ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN deleted_at TIMESTAMPTZ;