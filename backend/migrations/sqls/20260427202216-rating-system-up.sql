-- Deshawn King: 
-- This migration adds a new table called "ratings" to the database. The "ratings" table will store user ratings and reviews for their reservations. Each rating is associated with a specific reservation and user, and includes a rating value (between 1 and 5) and an optional review text. The table also includes timestamps for when each rating was created.

CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    reservation_id INT UNIQUE NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


