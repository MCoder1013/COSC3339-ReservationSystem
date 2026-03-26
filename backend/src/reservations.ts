import postgres, { Row, RowList, TransactionSql } from 'postgres';
import { sql } from './database.js';
import { checkResourceCount } from './resources.js';

type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled';

interface ReservationCheck {
    id: number
    start_time: string
    end_time: string
}

interface NewReservation {
    user_id: number
    cabin_id: number
    resource_id: number
    staff_id: number
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
    start_time: string
    end_time: string
    status: ReservationStatus
    created_at: string
    quantity_reserved: number
}

// checks for reservations to make sure the timeslots are not currently already being used for: staff members, resources, and cabins
async function checkResourceTime(r: ReservationCheck, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id FROM reservations
        WHERE
            resource_id = ${r.id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
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
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
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
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
    `;

    if (rows.length > 0) {
        throw new Error("That staff member is already reserved in that timeframe!");
    }
}

export async function addReservation(r: NewReservation): Promise<number> {
    return await sql.begin(async sql => {
        return await addReservationWithTransaction(sql, r)
    });
}

export async function addReservationWithTransaction(sql: postgres.TransactionSql<{}>, r: NewReservation): Promise<number> {
    if (r.staff_id != null) {
        await checkStaffTime({
            start_time: r.start_time,
            end_time: r.end_time,
            id: r.staff_id
        }, sql);
    }

    if (r.cabin_id != null) {
        await checkCabinTime({
            start_time: r.start_time,
            end_time: r.end_time,
            id: r.cabin_id
        }, sql);
    }

    if (r.resource_id != null) {
        await checkResourceCount(r, sql);
    }

    const result = await sql`
        INSERT INTO reservations
            (user_id, cabin_id, resource_id, staff_id,
            start_time, end_time, quantity_reserved)
        VALUES
            (${r.user_id}, ${r.cabin_id}, ${r.resource_id}, ${r.staff_id},
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
            r.id, user_id, cabin_id, resource_id, staff_id, start_time, end_time, r.status, r.created_at, r.quantity_reserved, u.email
        FROM
            reservations r,
            users u
        WHERE
            r.user_id = u.id AND
            r.end_time > NOW()
        `;

    return rows as any[] as Reservation[];
}

// Get all reservations with full details (rooms and resources joined)
export async function getAllReservationsWithDetails() {
    try {
        const rows = await sql`
            SELECT
                r.id,
                r.user_id,
                r.cabin_id,
                r.resource_id,
                r.staff_id,
                r.start_time,
                r.end_time,
                r.status,
                r.quantity_reserved,
                u.first_name,
                u.last_name,
                u.email,
                c.cabin_number,
                c.type,
                c.deck,
                c.capacity,
                res.name AS resource_name,
                res.category
            FROM reservations r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN cabins c ON r.cabin_id = c.id
            LEFT JOIN resources res ON r.resource_id = res.id
            ORDER BY r.start_time DESC
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
            r.quantity_reserved,
            u.email,
            res.name AS resource_name,
            c.cabin_number
        FROM reservations r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN resources res ON r.resource_id = res.id
        LEFT JOIN cabins c ON r.cabin_id = c.id
        WHERE r.user_id = ${userId}
        ORDER BY r.start_time DESC
    `;

    return rows;
}

export async function deleteReservation(id: number): Promise<void> {
    return await sql.begin(async sql => {
        await sql`DELETE FROM reservations WHERE id = ${id}`;
    })
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
                r.start_time,
                r.end_time,
                r.status
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN resources res ON r.resource_id = res.id
            WHERE r.user_id = ${userId} AND r.resource_id IS NOT NULL
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
                r.start_time,
                r.end_time,
                r.status
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN cabins c ON r.cabin_id = c.id
            WHERE r.user_id = ${userId}
                AND r.cabin_id IS NOT NULL
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