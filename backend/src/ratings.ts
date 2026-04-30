import postgres, { TransactionSql } from 'postgres';
import { sql } from './database.js';

export type ReviewTargetType = 'room' | 'event';

export type RatingReviewRow = {
    id: number;
    rating: number;
    review: string | null;
    created_at: string;
    reviewer_name: string;
    reviewer_email: string | null;
    reservation_id: number | null;
    package_event_id: number | null;
    cabin_id: number | null;
    cruise_id: number | null;
    cabin_number: string | null;
    cruise_name: string | null;
    ship_name: string | null;
    event_name: string | null;
    event_start_time: string | null;
    event_end_time: string | null;
};

const REVIEWER_NAME_SQL = "COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''), u.email, CAST(r.user_id AS TEXT))";

let schemaReadyPromise: Promise<void> | null = null;

export function ensureRatingsSchema() {
    if (!schemaReadyPromise) {
        schemaReadyPromise = sql.begin(async (tx) => {
            await tx`
                CREATE TABLE IF NOT EXISTS ratings (
                    id SERIAL PRIMARY KEY,
                    reservation_id INT UNIQUE,
                    package_event_id INT UNIQUE,
                    user_id INT NOT NULL,
                    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    review TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT ratings_target_check CHECK (
                        (
                            CASE WHEN reservation_id IS NOT NULL THEN 1 ELSE 0 END
                            + CASE WHEN package_event_id IS NOT NULL THEN 1 ELSE 0 END
                        ) = 1
                    ),
                    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
                    FOREIGN KEY (package_event_id) REFERENCES package_events(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `;

            await tx`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_reservation_id
                ON ratings(reservation_id)
            `;

            await tx`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_package_event_id
                ON ratings(package_event_id)
            `;

            await tx`
                ALTER TABLE ratings
                ADD COLUMN IF NOT EXISTS package_event_id INT
            `;

            await tx`
                ALTER TABLE ratings
                ALTER COLUMN reservation_id DROP NOT NULL
            `;
        });
    }

    return schemaReadyPromise;
}

function normalizeReviewText(review: unknown) {
    const text = String(review ?? '').trim();
    return text.length > 0 ? text : null;
}

async function ensureRoomReviewTarget(reservationId: number, userId: number, tx: TransactionSql<{}>) {
    const rows = await tx`
        SELECT
            r.id,
            r.cabin_id,
            r.cruise_id,
            r.start_time,
            r.end_time
        FROM reservations r
        WHERE r.id = ${reservationId}
          AND r.status <> 'Cancelled'
          AND r.end_time < NOW()
          AND (
                r.user_id = ${userId}
                OR EXISTS (
                    SELECT 1
                    FROM reservation_groups rg
                    WHERE rg.reservation_id = r.id
                      AND rg.user_id = ${userId}
                )
          )
        LIMIT 1
    `;

    if (rows.length === 0) {
        throw new Error('You can only review a past room reservation that belongs to you.');
    }

    return rows[0] as { id: number; cabin_id: number | null; cruise_id: number | null; start_time: string; end_time: string };
}

async function ensureEventReviewTarget(eventId: number, userId: number, tx: TransactionSql<{}>) {
    const rows = await tx`
        SELECT
            e.id,
            e.name,
            e.start_time,
            e.end_time
        FROM package_events e
        WHERE e.id = ${eventId}
          AND e.status <> 'Cancelled'
          AND e.end_time < NOW()
          AND EXISTS (
                SELECT 1
                FROM package_event_attendees pea
                WHERE pea.event_id = e.id
                  AND pea.user_id = ${userId}
          )
        LIMIT 1
    `;

    if (rows.length === 0) {
        throw new Error('You can only review a past event that you joined.');
    }

    return rows[0] as { id: number; name: string; start_time: string; end_time: string };
}

function isValidRating(rating: unknown) {
    return Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5;
}

export async function saveRoomRating(reservationId: number, userId: number, rating: number, review: unknown) {
    return sql.begin(async (tx) => {
        await ensureRoomReviewTarget(reservationId, userId, tx);
        const normalizedReview = normalizeReviewText(review);

        const rows = await tx<RatingReviewRow[]>`
            INSERT INTO ratings (reservation_id, package_event_id, user_id, rating, review)
            VALUES (${reservationId}, NULL, ${userId}, ${rating}, ${normalizedReview})
            ON CONFLICT (reservation_id)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                rating = EXCLUDED.rating,
                review = EXCLUDED.review,
                package_event_id = NULL
            RETURNING id, rating, review, created_at, user_id, reservation_id, package_event_id
        `;

        return rows[0];
    });
}

export async function saveEventRating(eventId: number, userId: number, rating: number, review: unknown) {
    return sql.begin(async (tx) => {
        await ensureEventReviewTarget(eventId, userId, tx);
        const normalizedReview = normalizeReviewText(review);

        const rows = await tx<RatingReviewRow[]>`
            INSERT INTO ratings (reservation_id, package_event_id, user_id, rating, review)
            VALUES (NULL, ${eventId}, ${userId}, ${rating}, ${normalizedReview})
            ON CONFLICT (package_event_id)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                rating = EXCLUDED.rating,
                review = EXCLUDED.review,
                reservation_id = NULL
            RETURNING id, rating, review, created_at, user_id, reservation_id, package_event_id
        `;

        return rows[0];
    });
}

export async function getRoomRatings(cabinId: number, cruiseId: number) {
    const rows = await sql<RatingReviewRow[]>`
        SELECT
            r.id,
            r.rating,
            r.review,
            r.created_at,
            ${sql.unsafe(REVIEWER_NAME_SQL)} AS reviewer_name,
            u.email AS reviewer_email,
            r.reservation_id,
            r.package_event_id,
            res.cabin_id,
            res.cruise_id,
            cab.cabin_number,
            c.cruise_name,
            c.ship_name,
            NULL::TEXT AS event_name,
            NULL::TIMESTAMPTZ AS event_start_time,
            NULL::TIMESTAMPTZ AS event_end_time
        FROM ratings r
        JOIN reservations res ON res.id = r.reservation_id
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN cabins cab ON cab.id = res.cabin_id
        LEFT JOIN cruises c ON c.id = res.cruise_id
        WHERE res.cabin_id = ${cabinId}
          AND res.cruise_id = ${cruiseId}
          AND res.status <> 'Cancelled'
        ORDER BY r.created_at DESC
    `;

    return rows;
}

export async function getEventRatings(eventId: number) {
    const rows = await sql<RatingReviewRow[]>`
        SELECT
            r.id,
            r.rating,
            r.review,
            r.created_at,
            ${sql.unsafe(REVIEWER_NAME_SQL)} AS reviewer_name,
            u.email AS reviewer_email,
            r.reservation_id,
            r.package_event_id,
            NULL::INT AS cabin_id,
            e.cruise_id,
            NULL::TEXT AS cabin_number,
                        c.cruise_name,
                        c.ship_name,
            e.name AS event_name,
            e.start_time AS event_start_time,
            e.end_time AS event_end_time
        FROM ratings r
        JOIN package_events e ON e.id = r.package_event_id
        LEFT JOIN users u ON u.id = r.user_id
                LEFT JOIN cruises c ON c.id = e.cruise_id
        WHERE e.id = ${eventId}
          AND e.status <> 'Cancelled'
        ORDER BY r.created_at DESC
    `;

    return rows;
}

export function isRatingValueValid(rating: unknown) {
    return isValidRating(rating);
}
