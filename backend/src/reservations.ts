import postgres, { Row, RowList, TransactionSql } from 'postgres';
import { sql } from './database.js';
import { checkResourceCount } from './resources.js';
import { sendEmailToUserForCancellation } from "./notifications.js"

type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled';

interface ReservationCheck {
    id: number
    cruise_id: number | null
    start_time: string
    end_time: string
}

interface NewReservation {
    user_id: number
    cabin_id: number
    resource_id: number
    staff_id: number
    cruise_id: number | null
    start_time: string
    end_time: string
    quantity_reserved: number
}

interface Reservation {
    id: number
    user_id: number
    cabin_id: number
    resource_id: number
    staff_id: number
    cruise_id: number | null
    start_time: string
    end_time: string
    status: ReservationStatus
    created_at: string
    quantity_reserved: number
    cancelled_at: string
}

// checks for reservations to make sure the timeslots are not currently already being used for: staff members, resources, and cabins
async function checkResourceTime(r: ReservationCheck, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id FROM reservations
        WHERE
            resource_id = ${r.id}
            AND cruise_id IS NOT DISTINCT FROM ${r.cruise_id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
            AND status != 'Cancelled'
            
    `;

    if (rows.length > 0) {
        throw new Error("That resource is already reserved in that timeframe!");
    }
}

async function checkCabinTime(r: ReservationCheck, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id FROM reservations
        WHERE
            cabin_id = ${r.id}
            AND cruise_id IS NOT DISTINCT FROM ${r.cruise_id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
            AND status != 'Cancelled'
    `;

    if (rows.length > 0) {
        throw new Error("That cabin is already reserved in that timeframe!");
    }
}

async function checkStaffTime(r: ReservationCheck, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id FROM reservations
        WHERE
            staff_id = ${r.id}
            AND cruise_id IS NOT DISTINCT FROM ${r.cruise_id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
            AND status != 'Cancelled'
    `;

    if (rows.length > 0) {
        throw new Error("That staff member is already reserved in that timeframe!");
    }
}

async function checkUserCruiseOverlap(userId: number, r: NewReservation, sql: TransactionSql<{}>) {
    if (r.cruise_id == null) {
        return;
    }

    const rows = await sql`
        SELECT
            existing.id,
            existing.user_id,
            u.email,
            u.first_name,
            u.last_name,
            existing.cruise_id,
            existing.start_time,
            existing.end_time
        FROM reservations existing
        JOIN cruises existing_cruise ON existing_cruise.id = existing.cruise_id
        JOIN cruises requested_cruise ON requested_cruise.id = ${r.cruise_id}
        LEFT JOIN users u ON u.id = existing.user_id
        WHERE
            (
                existing.user_id = ${userId}
                OR EXISTS (
                    SELECT 1
                    FROM reservation_groups rg
                    WHERE rg.reservation_id = existing.id
                        AND rg.user_id = ${userId}
                )
            )
            AND existing.cruise_id IS NOT NULL
            AND existing.status <> 'Cancelled'
            AND existing.cruise_id <> ${r.cruise_id}
            AND daterange(existing_cruise.departure_date, existing_cruise.return_date, '[]')
                && daterange(requested_cruise.departure_date, requested_cruise.return_date, '[]')
        LIMIT 1
    `;

    if (rows.length > 0) {
        const conflict = rows[0];
        const conflictLabel = conflict.email || [conflict.first_name, conflict.last_name].filter(Boolean).join(' ') || `user ${conflict.user_id}`;
        console.warn('[ReservationConflict][CruiseOverlap]', {
            checked_user_id: userId,
            requested_cruise_id: r.cruise_id,
            requested_start_time: r.start_time,
            requested_end_time: r.end_time,
            conflicting_reservation_id: conflict.id,
            conflicting_user_id: conflict.user_id,
            conflicting_cruise_id: conflict.cruise_id,
            conflicting_start_time: conflict.start_time,
            conflicting_end_time: conflict.end_time
        });
        throw new Error(`Guest ${conflictLabel} already has a reservation on another cruise with overlapping dates.`);
    }
}

async function checkUserRoomOnCruise(userId: number, r: NewReservation, sql: TransactionSql<{}>) {
    if (r.cabin_id == null || r.cruise_id == null) {
        return;
    }

    const rows = await sql`
        SELECT
            existing.id,
            existing.user_id,
            u.email,
            u.first_name,
            u.last_name,
            existing.cabin_id,
            existing.cruise_id,
            existing.start_time,
            existing.end_time
        FROM reservations existing
        LEFT JOIN users u ON u.id = existing.user_id
        WHERE
            (
                existing.user_id = ${userId}
                OR EXISTS (
                    SELECT 1
                    FROM reservation_groups rg
                    WHERE rg.reservation_id = existing.id
                        AND rg.user_id = ${userId}
                )
            )
            AND existing.cabin_id IS NOT NULL
            AND existing.cruise_id = ${r.cruise_id}
            AND existing.status <> 'Cancelled'
            AND existing.start_time < ${r.end_time}
            AND existing.end_time > ${r.start_time}
        LIMIT 1
    `;

    if (rows.length > 0) {
        const conflict = rows[0];
        const conflictLabel = conflict.email || [conflict.first_name, conflict.last_name].filter(Boolean).join(' ') || `user ${conflict.user_id}`;
        console.warn('[ReservationConflict][RoomOnCruise]', {
            checked_user_id: userId,
            requested_cruise_id: r.cruise_id,
            requested_cabin_id: r.cabin_id,
            requested_start_time: r.start_time,
            requested_end_time: r.end_time,
            conflicting_reservation_id: conflict.id,
            conflicting_user_id: conflict.user_id,
            conflicting_cruise_id: conflict.cruise_id,
            conflicting_cabin_id: conflict.cabin_id,
            conflicting_start_time: conflict.start_time,
            conflicting_end_time: conflict.end_time
        });
        throw new Error(`ROOM_CONFLICT: Guest ${conflictLabel} already has a room reservation on this cruise. (reservation ${conflict.id})`);
    }
}

async function checkCruiseIsUpcoming(cruiseId: number, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id
        FROM cruises
        WHERE id = ${cruiseId}
            AND return_date >= CURRENT_DATE
        LIMIT 1
    `;

    if (rows.length === 0) {
        throw new Error('You cannot make a reservation for a cruise that already ended.');
    }
}

export async function addReservation(r: NewReservation, participantUserIds?: number[]): Promise<number> {
    return await sql.begin(async sql => {
        return await addReservationWithTransaction(sql, r, participantUserIds)
    });
}

export async function addReservationWithTransaction(sql: postgres.TransactionSql<{}>, r: NewReservation, participantUserIds?: number[]): Promise<number> {
    const effectiveParticipants = participantUserIds && participantUserIds.length > 0
        ? Array.from(new Set(participantUserIds))
        : [r.user_id];

    for (const participantId of effectiveParticipants) {
        await checkUserCruiseOverlap(participantId, r, sql);
        await checkUserRoomOnCruise(participantId, r, sql);
    }

    if (r.cruise_id != null) {
        await checkCruiseIsUpcoming(r.cruise_id, sql);
    }

    if (r.staff_id != null) {
        await checkStaffTime({
            start_time: r.start_time,
            end_time: r.end_time,
            id: r.staff_id,
            cruise_id: r.cruise_id
        }, sql);
    }

    if (r.cabin_id != null) {
        await checkCabinTime({
            start_time: r.start_time,
            end_time: r.end_time,
            id: r.cabin_id,
            cruise_id: r.cruise_id
        }, sql);
    }

    if (r.resource_id != null) {
        await checkResourceCount(r, sql);
    }

    const result = await sql`
        INSERT INTO reservations
            (user_id, cabin_id, resource_id, staff_id, cruise_id,
            start_time, end_time, quantity_reserved)
        VALUES
            (${r.user_id}, ${r.cabin_id}, ${r.resource_id}, ${r.staff_id}, ${r.cruise_id},
            ${r.start_time}, ${r.end_time}, ${r.quantity_reserved})
        RETURNING id
    `;
    const newId = result[0].id

    return newId
}

// Add additional guests to a reservation
export async function addGuestsToReservation(reservationId: number, guestUserIds: number[]): Promise<void> {
    for (const userId of guestUserIds) {
        await sql`
            INSERT INTO reservation_groups (user_id, reservation_id)
            VALUES (${userId}, ${reservationId})
        `;
    }
}

export async function pullReservations(): Promise<Reservation[]> {
    // required info: Reservation ID, Name of Item Reserved, User Email, Start
    // Date, End Date. also, it shouldn't show reservations from the past.

    const rows = await sql`
        SELECT
            r.id, user_id, cabin_id, resource_id, staff_id, cruise_id, start_time, end_time, r.status, r.created_at, r.quantity_reserved, u.email
        FROM
            reservations r,
            users u
        WHERE
            r.user_id = u.id AND
            r.end_time > NOW()
            AND r.status != 'Cancelled'
        `;

    return rows as any[] as Reservation[];
}

// Get all reservations with full details (rooms and resources joined)
export async function getAllReservationsWithDetails() {
    try {
        const rows = await sql`
            SELECT *
            FROM (
                SELECT
                    r.id,
                    'reservation' AS reservation_type,
                    NULL::INT AS event_id,
                    NULL::VARCHAR AS event_name,
                    r.user_id,
                    r.cabin_id,
                    r.resource_id,
                    r.staff_id,
                    r.cruise_id,
                    r.start_time,
                    r.end_time,
                    r.status,
                    r.cancelled_at,
                    r.cancelled_by_role,
                    r.cancellation_reason,
                    r.quantity_reserved,
                    u.first_name,
                    u.last_name,
                    u.email,
                    c.cabin_number,
                    c.type::VARCHAR AS type,
                    c.deck,
                    c.capacity,
                    cr.cruise_name,
                    res.name AS resource_name,
                    res.category
                FROM reservations r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN cabins c ON r.cabin_id = c.id
                LEFT JOIN cruises cr ON r.cruise_id = cr.id
                LEFT JOIN resources res ON r.resource_id = res.id

                UNION ALL

                SELECT
                    (-1 * (pe.id * 1000 + pei.resource_id))::INT AS id,
                    'package_event_item' AS reservation_type,
                    pe.id AS event_id,
                    pe.name AS event_name,
                    pe.created_by AS user_id,
                    NULL::INT AS cabin_id,
                    pei.resource_id,
                    NULL::INT AS staff_id,
                    pe.cruise_id,
                    pe.start_time,
                    pe.end_time,
                    CASE
                        WHEN pe.status = 'Cancelled' THEN 'Cancelled'::reservations_status
                        ELSE 'Confirmed'::reservations_status
                    END AS status,
                    pe.cancelled_at,
                    pe.cancelled_by_role,
                    pe.cancellation_reason,
                    pei.quantity_required AS quantity_reserved,
                    u.first_name,
                    u.last_name,
                    u.email,
                    NULL::VARCHAR AS cabin_number,
                    NULL::VARCHAR AS type,
                    NULL::INT AS deck,
                    NULL::INT AS capacity,
                    cr.cruise_name,
                    res.name AS resource_name,
                    res.category
                FROM package_event_items pei
                JOIN package_events pe ON pe.id = pei.event_id
                JOIN users u ON u.id = pe.created_by
                JOIN cruises cr ON cr.id = pe.cruise_id
                JOIN resources res ON res.id = pei.resource_id
            ) combined
            ORDER BY combined.start_time DESC
        `;
        return rows;
    } catch (error) {
        console.error("Error getting all reservations with details: ", error);
        throw error;
    }
}

export async function getReservationsByUser(userId: number): Promise<RowList<Row[]>> {
    const rows = await sql`
        SELECT
            r.id,
            r.start_time,
            r.end_time,
            r.resource_id,
            r.cabin_id,
            r.cruise_id,
            r.quantity_reserved,
            r.status,
            r.cancelled_at,
            u.email,
            cr.cruise_name,
            res.name AS resource_name,
            c.cabin_number
        FROM reservations r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN resources res ON r.resource_id = res.id
        LEFT JOIN cabins c ON r.cabin_id = c.id
        LEFT JOIN cruises cr ON r.cruise_id = cr.id
                WHERE r.user_id = ${userId}
                     OR EXISTS (
                             SELECT 1
                             FROM reservation_groups rg
                             WHERE rg.reservation_id = r.id
                                 AND rg.user_id = ${userId}
                     )
        ORDER BY r.start_time DESC
    `;

    return rows;
}

export async function deleteReservation(id: number, cancelledByUserId?: number, cancelledByRole?: string, cancellationReason?: string): Promise<void> {
    await sql.begin(async sql => {
        await sql`
            UPDATE reservations
            SET 
                status = 'Cancelled',
                cancelled_by_user_id = ${cancelledByUserId ?? null},
                cancelled_by_role = ${cancelledByRole ?? null},
                cancellation_reason = ${cancellationReason ?? null},
                cancelled_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
        `;
    })

    try {
        const email = await getEmailFromReservationId(id);
        await sendEmailToUserForCancellation(email, cancellationReason, id); 
    } catch(error) {
        console.log("error sending email");
        throw(error);
    }

}

// Get all item reservations for a specific user
export async function getUserItemReservations(userId: number) {
    try {
        const rows = await sql`
            SELECT
                r.id,
                u.first_name,
                u.last_name,
                res.name AS resource_name,
                res.category,
                r.cruise_id,
                cr.cruise_name,
                r.start_time,
                r.end_time,
                r.status
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN resources res ON r.resource_id = res.id
            LEFT JOIN cruises cr ON r.cruise_id = cr.id
            WHERE r.user_id = ${userId} AND r.resource_id IS NOT NULL AND r.status != 'Cancelled'
            ORDER BY r.start_time DESC
        `;
        return rows;
    } catch (error) {
        console.error("Error getting user item reservations: ", error);
        throw error;
    }
}

export async function getUserRoomReservations(userId: number) {
    try {
        const rows = await sql`
            SELECT
                r.id,
                u.first_name,
                u.last_name,
                c.cabin_number,
                r.cruise_id,
                cr.cruise_name,
                r.start_time,
                r.end_time,
                r.status
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN cabins c ON r.cabin_id = c.id
            LEFT JOIN cruises cr ON r.cruise_id = cr.id
            WHERE r.cabin_id IS NOT NULL
                AND (
                    r.user_id = ${userId}
                    OR EXISTS (
                        SELECT 1
                        FROM reservation_groups rg
                        WHERE rg.reservation_id = r.id
                          AND rg.user_id = ${userId}
                    )
                )
            ORDER BY r.start_time DESC
        `;

        return rows;
    } catch (error) {
        console.error("Error getting user room reservations: ", error);
        throw error;
    }
}

export async function updateReservation(
    reservationId: number,
    userId: number,
    updates: {
        start_time?: string;
        end_time?: string;
        quantity_reserved?: number;
    }
) {
    return await sql.begin(async sql => {
        const reservationRows = await sql`SELECT * FROM reservations WHERE id = ${reservationId}`;
        const reservationData = reservationRows[0] as NewReservation

        // Delete the reservation so it's ignored when we're checking for
        // conflicts. Since we're in a transaction, this'll get rolled back if
        // something errors.
        await sql`DELETE FROM reservations WHERE id = ${reservationId}`

        reservationData.start_time = updates.start_time ?? reservationData.start_time
        reservationData.end_time = updates.end_time ?? reservationData.end_time
        reservationData.quantity_reserved = updates.quantity_reserved ?? reservationData.quantity_reserved

        await addReservationWithTransaction(sql, reservationData)

        const newReservationRows = await sql`
            SELECT * FROM reservations WHERE id = ${reservationId}`;
        const newReservationData = newReservationRows[0] as NewReservation
        return newReservationData
    })
}

export async function getUserRoomCruises(userId: number) {
    const rows = await sql`
        SELECT DISTINCT
            cr.id,
            cr.cruise_name,
            cr.ship_name,
            cr.departure_date,
            cr.return_date,
            cr.max_passengers
        FROM reservations r
        JOIN cruises cr ON cr.id = r.cruise_id
        WHERE
            r.cabin_id IS NOT NULL
            AND r.status <> 'Cancelled'
            AND r.end_time > NOW()
            AND cr.return_date >= CURRENT_DATE
            AND (
                r.user_id = ${userId}
                OR EXISTS (
                    SELECT 1
                    FROM reservation_groups rg
                    WHERE rg.reservation_id = r.id
                        AND rg.user_id = ${userId}
                )
            )
        ORDER BY cr.departure_date ASC
    `;

    return rows;
}

export async function getStaffEligibleCruises(userId: number) {
    const rows = await sql`
        WITH staff_cruise_ids AS (
            SELECT DISTINCT r.cruise_id AS cruise_id
            FROM reservations r
            WHERE r.cruise_id IS NOT NULL
              AND (
                    r.staff_id = ${userId}
                    OR EXISTS (
                        SELECT 1
                        FROM reservation_staff rs
                        WHERE rs.reservation_id = r.id
                          AND rs.staff_id = ${userId}
                    )
              )

            UNION

            SELECT DISTINCT pe.cruise_id AS cruise_id
            FROM package_events pe
            WHERE pe.cruise_id IS NOT NULL
              AND (
                    pe.created_by = ${userId}
                    OR EXISTS (
                        SELECT 1
                        FROM package_event_staff pes
                        WHERE pes.event_id = pe.id
                          AND pes.staff_id = ${userId}
                    )
              )
        )
        SELECT
            c.id,
            c.cruise_name,
            c.ship_name,
            c.departure_date,
            c.return_date,
            c.max_passengers
        FROM cruises c
        JOIN staff_cruise_ids sci ON sci.cruise_id = c.id
        WHERE c.return_date >= CURRENT_DATE
        ORDER BY c.departure_date ASC
    `;

    return rows;
}

export async function getEmailFromReservationId(id: number): Promise<string> {
    const rows = await sql`
        SELECT u.email
        FROM reservations r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ${id}
    `;

    if (rows.length === 0) {
        throw new Error("No reservation found with that ID");
    }

    return rows[0].email;
}
