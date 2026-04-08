import postgres from 'postgres';
import { sql } from './database.js';

export type PackageEventInput = {
    cruise_id: number;
    name: string;
    description: string;
    capacity: number;
    start_time: string;
    end_time: string;
    staff_ids: number[];
    item_requirements: Array<{ resource_id: number; quantity_required: number }>;
};

const SHIFT_TIME_ZONE = process.env.SHIFT_TIME_ZONE || 'America/Chicago';

// Reused SQL snippets for consistent staff display names across package-event queries.
const STAFF_DISPLAY_NAME_SQL = "COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''), u.email, CAST(s.staff_id AS TEXT))";
const STAFF_NAME_AGGREGATE_BY_EVENT_SQL = `
    SELECT
        pes.event_id,
        STRING_AGG(
            ${STAFF_DISPLAY_NAME_SQL},
            ', '
            ORDER BY ${STAFF_DISPLAY_NAME_SQL}
        ) AS staff_names
    FROM package_event_staff pes
    JOIN staff s ON s.staff_id = pes.staff_id
    LEFT JOIN users u ON u.id = s.staff_id
    GROUP BY pes.event_id
`;

const shiftTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SHIFT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

function getShiftTimeParts(date: Date) {
    const parts = shiftTimeFormatter.formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    const hour = Number(map.hour);
    const minute = Number(map.minute);

    return {
        year,
        month,
        day,
        hour,
        minute,
        dayIndex: Math.floor(Date.UTC(year, month - 1, day) / 86400000),
    };
}

function minutesSinceMidnightShiftTime(d: Date) {
    const parts = getShiftTimeParts(d);
    return parts.hour * 60 + parts.minute;
}

function isSameShiftDay(a: Date, b: Date) {
    const left = getShiftTimeParts(a);
    const right = getShiftTimeParts(b);
    return left.year === right.year && left.month === right.month && left.day === right.day;
}

function isNextShiftDay(a: Date, b: Date) {
    const left = getShiftTimeParts(a);
    const right = getShiftTimeParts(b);
    return right.dayIndex === left.dayIndex + 1;
}

function roundUpToNextThirtyMinutes(d: Date) {
    const rounded = new Date(d);
    rounded.setSeconds(0, 0);
    const minutes = rounded.getMinutes();
    const remainder = minutes % 30;
    if (remainder !== 0) {
        rounded.setMinutes(minutes + (30 - remainder));
    }
    return rounded;
}

function isWithinShiftWindow(shift: string, start: Date, end: Date): boolean {
    const normalized = shift.charAt(0).toUpperCase() + shift.slice(1).toLowerCase();

    const startMinutes = minutesSinceMidnightShiftTime(start);
    const endMinutes = minutesSinceMidnightShiftTime(end);

    const sameShiftDay = isSameShiftDay(start, end);
    const nextShiftDay = isNextShiftDay(start, end);

    if (normalized  === 'Morning') {
        return sameShiftDay && startMinutes >= 360 && endMinutes <= 720;
    }

    if (normalized  === 'Day') {
        return sameShiftDay && startMinutes >= 720 && endMinutes <= 1080;
    }

    if (normalized  === 'Night') {
        const sameDayNight = sameShiftDay && startMinutes >= 1080 && endMinutes <= 1439;
        const midnightBoundary = nextShiftDay && startMinutes >= 1080 && endMinutes === 0;
        return sameDayNight || midnightBoundary;
    }

    return false;
}

function validateEventWindowRules(start: Date, end: Date) {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new Error('Please choose a valid start and end time.');
    }

    const nowRounded = roundUpToNextThirtyMinutes(new Date());
    if (start < nowRounded) {
        throw new Error('Please choose a future start time.');
    }

    const sameDay = isSameShiftDay(start, end);

    if (sameDay) {
        return;
    }

    const isNextDay = isNextShiftDay(start, end);

    const startMinutes = minutesSinceMidnightShiftTime(start);
    const endMinutes = minutesSinceMidnightShiftTime(end);

    if (!isNextDay || startMinutes < 1080 || endMinutes !== 0) {
        throw new Error('Events must start and end on the same day. Night-shift events may end at midnight.');
    }
}

async function validateStaffShiftWindows(staffIds: number[], startTime: string, endTime: string, tx: postgres.TransactionSql<{}>) {
    if (staffIds.length === 0) {
        throw new Error('Please assign at least one staff member.');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    validateEventWindowRules(start, end);

    const rows = await tx`
        SELECT
            s.staff_id AS id,
            ${sql.unsafe(STAFF_DISPLAY_NAME_SQL)} AS name,
            s.shift
        FROM staff s
        LEFT JOIN users u ON u.id = s.staff_id
        WHERE s.staff_id IN ${tx(staffIds)}
    `;

    if (rows.length !== staffIds.length) {
        throw new Error('One or more selected staff members could not be found.');
    }

    for (const staffMember of rows) {
        if (!isWithinShiftWindow(staffMember.shift, start, end)) {
            throw new Error(`This time is outside ${staffMember.name}'s shift (${staffMember.shift}).`);
        }
    }
}

async function validateCreatorShiftWindow(createdBy: number, start: Date, end: Date, tx: postgres.TransactionSql<{}>) {
    const rows = await tx`
        SELECT
            s.staff_id AS id,
            ${sql.unsafe(STAFF_DISPLAY_NAME_SQL)} AS name,
            s.shift
        FROM staff s
        LEFT JOIN users u ON u.id = s.staff_id
        WHERE s.staff_id = ${createdBy}
    `;

    if (rows.length === 0) {
        throw new Error('We could not verify the event creator shift details.');
    }

    const creator = rows[0];
    if (!isWithinShiftWindow(creator.shift, start, end)) {
        throw new Error(`This time is outside your shift (${creator.shift}).`);
    }
}

async function validateItemAvailability(
    itemRequirements: Array<{ resource_id: number; quantity_required: number }>,
    cruiseId: number,
    startTime: string,
    endTime: string,
    tx: postgres.TransactionSql<{}>,
    excludeEventId?: number
) {
    for (const item of itemRequirements) {
        const [resource] = await tx`
            SELECT id, name, quantity
            FROM resources
            WHERE id = ${item.resource_id}
            FOR UPDATE
        `;

        if (!resource) {
            throw new Error(`The selected resource (${item.resource_id}) could not be found.`);
        }

        const [reservationUsage] = await tx`
            SELECT COALESCE(SUM(quantity_reserved), 0) AS total_reserved
            FROM reservations
            WHERE resource_id = ${item.resource_id}
              AND cruise_id = ${cruiseId}
              AND start_time < ${endTime}
              AND end_time > ${startTime}
        `;

        const packageUsageRows = await tx`
            SELECT COALESCE(SUM(ei.quantity_required), 0) AS total_required
            FROM package_events e
            JOIN package_event_items ei ON ei.event_id = e.id
            WHERE e.status <> 'Cancelled'
                            AND e.cruise_id = ${cruiseId}
              AND ei.resource_id = ${item.resource_id}
              AND e.start_time < ${endTime}
              AND e.end_time > ${startTime}
              AND (${excludeEventId ?? null}::INT IS NULL OR e.id <> ${excludeEventId ?? null})
        `;

        const packageUsage = packageUsageRows[0]?.total_required ?? 0;
        const reservationReserved = reservationUsage?.total_reserved ?? 0;
        const totalAllocated = Number(reservationReserved) + Number(packageUsage);
        const available = Number(resource.quantity) - totalAllocated;

        if (item.quantity_required > available) {
            throw new Error(`Not enough ${resource.name}. Requested ${item.quantity_required}, available ${Math.max(available, 0)}.`);
        }
    }
}

async function validateCruiseExists(cruiseId: number, tx: postgres.TransactionSql<{}>) {
    const rows = await tx`
        SELECT id
        FROM cruises
        WHERE id = ${cruiseId}
          AND return_date >= CURRENT_DATE
        LIMIT 1
    `;

    if (rows.length === 0) {
        throw new Error('Please select a valid current or future cruise for this event.');
    }
}

async function hasUserCruiseRoomAccess(userId: number, cruiseId: number, tx: postgres.TransactionSql<{}>) {
    const rows = await tx`
        SELECT 1
        FROM reservations r
        WHERE
            r.cabin_id IS NOT NULL
            AND r.cruise_id = ${cruiseId}
            AND r.status <> 'Cancelled'
            AND r.end_time > NOW()
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

    return rows.length > 0;
}

export async function canUserAccessCruiseEvents(userId: number, cruiseId: number) {
    return await sql.begin(async (tx) => {
        return await hasUserCruiseRoomAccess(userId, cruiseId, tx);
    });
}

async function replaceEventStaff(eventId: number, staffIds: number[], tx: postgres.TransactionSql<{}>) {
    await tx`DELETE FROM package_event_staff WHERE event_id = ${eventId}`;
    if (staffIds.length === 0) return;

    for (const staffId of staffIds) {
        await tx`
            INSERT INTO package_event_staff (event_id, staff_id)
            VALUES (${eventId}, ${staffId})
        `;
    }
}

async function replaceEventItems(
    eventId: number,
    itemRequirements: Array<{ resource_id: number; quantity_required: number }>,
    tx: postgres.TransactionSql<{}>
) {
    await tx`DELETE FROM package_event_items WHERE event_id = ${eventId}`;

    for (const item of itemRequirements) {
        await tx`
            INSERT INTO package_event_items (event_id, resource_id, quantity_required)
            VALUES (${eventId}, ${item.resource_id}, ${item.quantity_required})
        `;
    }
}

export async function createPackageEvent(createdBy: number, input: PackageEventInput) {
    return await sql.begin(async (tx) => {
        const start = new Date(input.start_time);
        const end = new Date(input.end_time);

        validateEventWindowRules(start, end);
        await validateCruiseExists(input.cruise_id, tx);
        await validateCreatorShiftWindow(createdBy, start, end, tx);
        await validateStaffShiftWindows(input.staff_ids, input.start_time, input.end_time, tx);
        await validateItemAvailability(input.item_requirements, input.cruise_id, input.start_time, input.end_time, tx);

        const result = await tx`
            INSERT INTO package_events (cruise_id, name, description, capacity, start_time, end_time, created_by)
            VALUES (${input.cruise_id}, ${input.name}, ${input.description}, ${input.capacity}, ${input.start_time}, ${input.end_time}, ${createdBy})
            RETURNING id
        `;

        const eventId = result[0].id;

        await replaceEventStaff(eventId, input.staff_ids, tx);
        await replaceEventItems(eventId, input.item_requirements, tx);

        return eventId;
    });
}

export async function updatePackageEvent(eventId: number, input: PackageEventInput) {
    return await sql.begin(async (tx) => {
        const start = new Date(input.start_time);
        const end = new Date(input.end_time);
        validateEventWindowRules(start, end);
        await validateCruiseExists(input.cruise_id, tx);

        const eventRows = await tx`
            SELECT created_by
            FROM package_events
            WHERE id = ${eventId}
        `;

        if (eventRows.length === 0) {
            throw new Error('This event could not be found.');
        }

        await validateCreatorShiftWindow(eventRows[0].created_by, start, end, tx);
        await validateStaffShiftWindows(input.staff_ids, input.start_time, input.end_time, tx);
        await validateItemAvailability(input.item_requirements, input.cruise_id, input.start_time, input.end_time, tx, eventId);

        await tx`
            UPDATE package_events
            SET cruise_id = ${input.cruise_id},
                name = ${input.name},
                description = ${input.description},
                capacity = ${input.capacity},
                start_time = ${input.start_time},
                end_time = ${input.end_time}
            WHERE id = ${eventId}
        `;

        await replaceEventStaff(eventId, input.staff_ids, tx);
        await replaceEventItems(eventId, input.item_requirements, tx);
    });
}

export async function cancelPackageEvent(eventId: number) {
    await sql`
        UPDATE package_events
        SET status = 'Cancelled'
        WHERE id = ${eventId}
    `;
}

export async function getPackageEventById(eventId: number) {
    const eventRows = await sql`
        SELECT
            e.id,
            e.cruise_id,
            cr.cruise_name,
            e.name,
            e.description,
            e.capacity,
            e.start_time,
            e.end_time,
            e.status,
            e.created_by,
            COALESCE(att.total_attendees, 0) AS total_attendees,
            GREATEST(e.capacity - COALESCE(att.total_attendees, 0), 0) AS spots_left,
            (COALESCE(att.total_attendees, 0) >= e.capacity) AS is_full
        FROM package_events e
        LEFT JOIN cruises cr ON cr.id = e.cruise_id
        LEFT JOIN (
            SELECT event_id, COUNT(*)::INT AS total_attendees
            FROM package_event_attendees
            GROUP BY event_id
        ) att ON att.event_id = e.id
        WHERE e.id = ${eventId}
    `;

    if (eventRows.length === 0) {
        return null;
    }

    const staffRows = await sql`
        SELECT
            s.staff_id AS id,
            ${sql.unsafe(STAFF_DISPLAY_NAME_SQL)} AS name,
            s.role,
            s.shift
        FROM package_event_staff pes
        JOIN staff s ON s.staff_id = pes.staff_id
        LEFT JOIN users u ON u.id = s.staff_id
        WHERE pes.event_id = ${eventId}
        ORDER BY name
    `;

    const itemRows = await sql`
        SELECT r.id AS resource_id, r.name AS resource_name, pei.quantity_required
        FROM package_event_items pei
        JOIN resources r ON r.id = pei.resource_id
        WHERE pei.event_id = ${eventId}
        ORDER BY r.name
    `;

    return {
        ...eventRows[0],
        staff: staffRows,
        items: itemRows,
    };
}

export async function listActivePackageEvents(userId?: number, cruiseId?: number) {
    if (userId && cruiseId != null) {
        const canAccess = await sql.begin(async (tx) => {
            return await hasUserCruiseRoomAccess(userId, cruiseId, tx);
        });

        if (!canAccess) {
            return [];
        }
    }

    const rows = await sql`
        SELECT
            e.id,
            e.cruise_id,
            cr.cruise_name,
            e.name,
            e.description,
            e.capacity,
            e.start_time,
            e.end_time,
            e.created_by,
            COALESCE(att.total_attendees, 0) AS total_attendees,
            GREATEST(e.capacity - COALESCE(att.total_attendees, 0), 0) AS spots_left,
            (COALESCE(att.total_attendees, 0) >= e.capacity) AS is_full,
            COALESCE(staff.staff_names, '') AS staff_names,
            EXISTS(
                SELECT 1
                FROM package_event_attendees pea
                WHERE pea.event_id = e.id
                  AND pea.user_id = ${userId ?? null}
            ) AS is_joined
        FROM package_events e
        LEFT JOIN cruises cr ON cr.id = e.cruise_id
        LEFT JOIN (
            SELECT event_id, COUNT(*)::INT AS total_attendees
            FROM package_event_attendees
            GROUP BY event_id
        ) att ON att.event_id = e.id
        LEFT JOIN (
            ${sql.unsafe(STAFF_NAME_AGGREGATE_BY_EVENT_SQL)}
        ) staff ON staff.event_id = e.id
        WHERE e.status <> 'Cancelled'
                    AND (${cruiseId ?? null}::INT IS NULL OR e.cruise_id = ${cruiseId ?? null})
        ORDER BY e.start_time
    `;

    return rows;
}

export async function listJoinedPackageEvents(userId: number) {
    const rows = await sql`
        SELECT
            e.id,
            e.cruise_id,
            cr.cruise_name,
            e.name,
            e.description,
            e.start_time,
            e.end_time,
            e.status,
            pea.joined_at,
            COALESCE(staff.staff_names, '') AS staff_names
        FROM package_event_attendees pea
        JOIN package_events e ON e.id = pea.event_id
        LEFT JOIN cruises cr ON cr.id = e.cruise_id
        LEFT JOIN (
            ${sql.unsafe(STAFF_NAME_AGGREGATE_BY_EVENT_SQL)}
        ) staff ON staff.event_id = e.id
        WHERE pea.user_id = ${userId}
        ORDER BY e.start_time DESC
    `;

    return rows;
}

export async function joinPackageEvent(eventId: number, userId: number) {
    return await sql.begin(async (tx) => {
        const eventRows = await tx`
            SELECT id, capacity, status, cruise_id
            FROM package_events
            WHERE id = ${eventId}
            FOR UPDATE
        `;

        if (eventRows.length === 0) {
            throw new Error('This event could not be found.');
        }

        const event = eventRows[0];
        if (event.status === 'Cancelled') {
            throw new Error('This event is no longer available.');
        }

        if (event.cruise_id == null) {
            throw new Error('This event is not linked to a cruise and cannot be reserved.');
        }

        const canAccess = await hasUserCruiseRoomAccess(userId, event.cruise_id, tx);
        if (!canAccess) {
            throw new Error('You must have an active room reservation on this cruise to join this event.');
        }

        const attendeeRows = await tx`
            SELECT COUNT(*)::INT AS count
            FROM package_event_attendees
            WHERE event_id = ${eventId}
        `;

        const attendeeCount = attendeeRows[0].count;

        if (attendeeCount >= event.capacity) {
            throw new Error('This event is full right now.');
        }

        await tx`
            INSERT INTO package_event_attendees (event_id, user_id)
            VALUES (${eventId}, ${userId})
            ON CONFLICT (event_id, user_id) DO NOTHING
        `;
    });
}

export async function leavePackageEvent(eventId: number, userId: number) {
    return await sql.begin(async (tx) => {
        const eventRows = await tx`
            SELECT id, status
            FROM package_events
            WHERE id = ${eventId}
            FOR UPDATE
        `;

        if (eventRows.length === 0) {
            throw new Error('This event could not be found.');
        }

        const result = await tx`
            DELETE FROM package_event_attendees
            WHERE event_id = ${eventId}
              AND user_id = ${userId}
        `;

        if (result.count === 0) {
            throw new Error('You do not currently have a reservation for this event.');
        }
    });
}
