ALTER DATABASE cruise_reservation SET TIMEZONE = 'UTC';
SELECT pg_reload_conf();

ALTER TABLE users
ALTER created_at TYPE timestamptz
USING created_at AT TIME ZONE 'UTC';

ALTER TABLE reservations
ALTER start_time TYPE timestamptz
USING start_time AT TIME ZONE 'UTC';

ALTER TABLE reservations
ALTER end_time TYPE timestamptz
USING end_time AT TIME ZONE 'UTC';

ALTER TABLE reservations
ALTER created_at TYPE timestamptz
USING created_at AT TIME ZONE 'UTC';
