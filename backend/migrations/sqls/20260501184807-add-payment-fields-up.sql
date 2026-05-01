-- Add payment tracking to reservations
ALTER TABLE reservations
ADD COLUMN payment_status TEXT CHECK (payment_status IN ('unpaid','paid')) DEFAULT 'unpaid',
ADD COLUMN payment_date TIMESTAMPTZ NULL,
ADD COLUMN total_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
