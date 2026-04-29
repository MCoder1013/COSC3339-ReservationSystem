CREATE TABLE loyalty_accounts ( -- New table for loyalty accounts
    user_id INT PRIMARY KEY,
    points INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_loyalty_user -- Foreign key to users table
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);