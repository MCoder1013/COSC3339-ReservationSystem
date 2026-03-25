INSERT INTO cruises (cruise_name, ship_name, departure_date, return_date, max_passengers)
VALUES
    ('Caribbean Star Escape', 'Starlight Pearl Cruises', '2026-04-15', '2026-04-22', 2200),
    ('Mediterranean Moonlight', 'Starlight Pearl Cruises', '2026-05-03', '2026-05-12', 2200),
    ('Alaskan Aurora Voyage', 'Starlight Pearl Cruises', '2026-06-10', '2026-06-18', 1800),
    ('Pacific Horizon Journey', 'Starlight Pearl Cruises', '2026-07-01', '2026-07-09', 2000)
ON CONFLICT (cruise_name, departure_date) DO NOTHING;
