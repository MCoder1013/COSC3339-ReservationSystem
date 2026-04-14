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
        mapping.event_id,
        STRING_AGG(
            ${STAFF_DISPLAY_NAME_SQL},
            ', '
            ORDER BY ${STAFF_DISPLAY_NAME_SQL}
        ) AS staff_names
    FROM (
        SELECT pes.event_id, pes.staff_id
        FROM package_event_staff pes
        UNION
        SELECT e.id AS event_id, e.created_by AS staff_id
        FROM package_events e
    ) mapping
    JOIN staff s ON s.staff_id = mapping.staff_id
    LEFT JOIN users u ON u.id = s.staff_id
    GROUP BY mapping.event_id
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

function deriveShiftFromWindow(start: Date, end: Date): 'Morning' | 'Day' | 'Night' | null {
    if (isWithinShiftWindow('Morning', start, end)) return 'Morning';
    if (isWithinShiftWindow('Day', start, end)) return 'Day';
    if (isWithinShiftWindow('Night', start, end)) return 'Night';
    return null;
}

function toShiftDateKey(d: Date): string {
    const parts = getShiftTimeParts(d);
    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');
    return `${parts.year}-${month}-${day}`;
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

async function validateSingleShiftPerDayAssignments(
    staffIds: number[],
    startTime: string,
    endTime: string,
    tx: postgres.TransactionSql<{}>,
    excludeEventId?: number
) {
    const targetStart = new Date(startTime);
    const targetEnd = new Date(endTime);
    const targetShift = deriveShiftFromWindow(targetStart, targetEnd);

    if (!targetShift) {
        throw new Error('This event does not fit a valid shift window.');
    }

    const targetDayKey = toShiftDateKey(targetStart);

    const existingAssignments = await tx`
        SELECT
            assignment.staff_id,
            e.id AS event_id,
            e.name AS event_name,
            e.start_time,
            e.end_time
        FROM (
            SELECT pes.staff_id, pes.event_id
            FROM package_event_staff pes
            UNION
            SELECT e.created_by AS staff_id, e.id AS event_id
            FROM package_events e
        ) assignment
        JOIN package_events e ON e.id = assignment.event_id
        WHERE assignment.staff_id IN ${tx(staffIds)}
          AND e.status <> 'Cancelled'
          AND (${excludeEventId ?? null}::INT IS NULL OR e.id <> ${excludeEventId ?? null})
        ORDER BY e.start_time ASC
    `;

    const conflicts: string[] = [];

    for (const row of existingAssignments) {
        const existingStart = new Date(row.start_time);
        const existingEnd = new Date(row.end_time);
        if (toShiftDateKey(existingStart) !== targetDayKey) {
            continue;
        }

        const existingShift = deriveShiftFromWindow(existingStart, existingEnd);
        if (!existingShift || existingShift === targetShift) {
            continue;
        }

        const displayName = String(row.event_name ?? `Event #${row.event_id}`);
        conflicts.push(`${displayName} (${existingShift})`);
    }

    if (conflicts.length > 0) {
        const summary = conflicts.slice(0, 3).join(', ');
        throw new Error(`Staff cannot be assigned to multiple shifts on the same day. Conflicts: ${summary}.`);
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
              AND start_time < ${endTime}
              AND end_time > ${startTime}
        `;

        const packageUsageRows = await tx`
            SELECT COALESCE(SUM(ei.quantity_required), 0) AS total_required
            FROM package_events e
            JOIN package_event_items ei ON ei.event_id = e.id
            WHERE e.status <> 'Cancelled'
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

function withRequiredStaffMember(staffIds: number[], requiredStaffId: number) {
    const unique = new Set(staffIds.filter((id) => Number.isInteger(id) && id > 0));
    if (Number.isInteger(requiredStaffId) && requiredStaffId > 0) {
        unique.add(requiredStaffId);
    }
    return Array.from(unique);
}

export async function createPackageEvent(createdBy: number, input: PackageEventInput) {
    return await sql.begin(async (tx) => {
        const creatorId = Number(createdBy);
        if (!Number.isInteger(creatorId) || creatorId < 1) {
            throw new Error('Could not verify the authenticated user for this request.');
        }

        const start = new Date(input.start_time);
        const end = new Date(input.end_time);
        const assignedStaffIds = withRequiredStaffMember(input.staff_ids, creatorId);

        validateEventWindowRules(start, end);
        await validateCreatorShiftWindow(creatorId, start, end, tx);
        await validateStaffShiftWindows(assignedStaffIds, input.start_time, input.end_time, tx);
        await validateSingleShiftPerDayAssignments(assignedStaffIds, input.start_time, input.end_time, tx);
        await validateItemAvailability(input.item_requirements, input.start_time, input.end_time, tx);

        const result = await tx`
            INSERT INTO package_events (cruise_id, name, description, capacity, start_time, end_time, created_by)
            VALUES (${input.cruise_id}, ${input.name}, ${input.description}, ${input.capacity}, ${input.start_time}, ${input.end_time}, ${creatorId})
            RETURNING id
        `;

        const eventId = result[0].id;

        await replaceEventStaff(eventId, assignedStaffIds, tx);
        await replaceEventItems(eventId, input.item_requirements, tx);

        return eventId;
    });
}

export async function updatePackageEvent(eventId: number, input: PackageEventInput) {
    return await sql.begin(async (tx) => {
        const start = new Date(input.start_time);
        const end = new Date(input.end_time);
        validateEventWindowRules(start, end);

        const eventRows = await tx`
            SELECT created_by
            FROM package_events
            WHERE id = ${eventId}
        `;

        if (eventRows.length === 0) {
            throw new Error('This event could not be found.');
        }

        const creatorId = Number(eventRows[0].created_by);
        const assignedStaffIds = withRequiredStaffMember(input.staff_ids, creatorId);

        await validateCreatorShiftWindow(creatorId, start, end, tx);
        await validateStaffShiftWindows(assignedStaffIds, input.start_time, input.end_time, tx);
        await validateSingleShiftPerDayAssignments(assignedStaffIds, input.start_time, input.end_time, tx, eventId);
        await validateItemAvailability(input.item_requirements, input.start_time, input.end_time, tx, eventId);

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

        await replaceEventStaff(eventId, assignedStaffIds, tx);
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

export async function getPackageEventById(eventId: number, viewerUserId?: number) {
    const eventRows = await sql`
        SELECT
            e.id,
            e.cruise_id,
            e.name,
            e.description,
            e.capacity,
            e.start_time,
            e.end_time,
            e.status,
            e.created_by,
            COALESCE(att.total_attendees, 0) AS total_attendees,
            GREATEST(e.capacity - COALESCE(att.total_attendees, 0), 0) AS spots_left,
                        (COALESCE(att.total_attendees, 0) >= e.capacity) AS is_full,
                        EXISTS(
                                SELECT 1
                                FROM package_event_attendees pea
                                WHERE pea.event_id = e.id
                                    AND pea.user_id = ${viewerUserId ?? null}
                        ) AS is_joined,
                        EXISTS(
                                SELECT 1
                                FROM package_event_staff pes
                                WHERE pes.event_id = e.id
                                    AND pes.staff_id = ${viewerUserId ?? null}
                        ) AS is_staffed
        FROM package_events e
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
        FROM (
            SELECT pes.staff_id
            FROM package_event_staff pes
            WHERE pes.event_id = ${eventId}
            UNION
            SELECT e.created_by AS staff_id
            FROM package_events e
            WHERE e.id = ${eventId}
        ) mapping
        JOIN staff s ON s.staff_id = mapping.staff_id
        LEFT JOIN users u ON u.id = s.staff_id
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

export async function listPackageEventAttendees(eventId: number) {
    const rows = await sql`
        SELECT
            u.id,
            COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''), u.email, CAST(u.id AS TEXT)) AS name,
            u.email,
            pea.joined_at
        FROM package_event_attendees pea
        JOIN users u ON u.id = pea.user_id
        WHERE pea.event_id = ${eventId}
        ORDER BY pea.joined_at ASC
    `;

    return rows;
}

export async function listActivePackageEvents(userId?: number, cruiseId?: number) {
    const rows = await sql`
        SELECT
            e.id,
            e.cruise_id,
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
                        ) AS is_joined,
                        EXISTS(
                                SELECT 1
                                FROM package_event_staff pes
                                WHERE pes.event_id = e.id
                                    AND pes.staff_id = ${userId ?? null}
                        ) AS is_staffed
        FROM package_events e
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
            e.name,
            e.description,
            e.capacity,
            e.start_time,
            e.end_time,
            e.status,
            e.created_by,
            COALESCE(att.total_attendees, 0) AS total_attendees,
            GREATEST(e.capacity - COALESCE(att.total_attendees, 0), 0) AS spots_left,
            (COALESCE(att.total_attendees, 0) >= e.capacity) AS is_full,
                        (
                                SELECT pea.joined_at
                                FROM package_event_attendees pea
                                WHERE pea.event_id = e.id
                                    AND pea.user_id = ${userId}
                                LIMIT 1
                        ) AS joined_at,
            EXISTS (
                SELECT 1
                FROM package_event_attendees pea
                WHERE pea.event_id = e.id
                  AND pea.user_id = ${userId}
            ) AS is_joined,
            EXISTS (
                SELECT 1
                FROM package_event_staff pes
                WHERE pes.event_id = e.id
                  AND pes.staff_id = ${userId}
            ) AS is_staffed,
            COALESCE(staff.staff_names, '') AS staff_names
                FROM package_events e
        LEFT JOIN (
            SELECT event_id, COUNT(*)::INT AS total_attendees
            FROM package_event_attendees
            GROUP BY event_id
        ) att ON att.event_id = e.id
        LEFT JOIN (
            ${sql.unsafe(STAFF_NAME_AGGREGATE_BY_EVENT_SQL)}
        ) staff ON staff.event_id = e.id
                WHERE e.status <> 'Cancelled'
                    AND (
                        EXISTS (
                                SELECT 1
                                FROM package_event_attendees pea
                                WHERE pea.event_id = e.id
                                    AND pea.user_id = ${userId}
                        )
                        OR EXISTS (
                                SELECT 1
                                FROM package_event_staff pes
                                WHERE pes.event_id = e.id
                                    AND pes.staff_id = ${userId}
                        )
                        OR e.created_by = ${userId}
                    )
        ORDER BY e.start_time DESC
    `;

    return rows;
}

export async function joinPackageEvent(eventId: number, userId: number) {
    return await sql.begin(async (tx) => {
        const eventRows = await tx`
            SELECT id, capacity, status, start_time, end_time
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

        const staffedOnTargetEventRows = await tx`
            SELECT 1
            FROM package_event_staff pes
            WHERE pes.event_id = ${eventId}
              AND pes.staff_id = ${userId}
            LIMIT 1
        `;

        if (staffedOnTargetEventRows.length > 0) {
            throw new Error('You are assigned as staff for this event and cannot join as an attendee.');
        }

        const staffRows = await tx`
            SELECT shift
            FROM staff
            WHERE staff_id = ${userId}
            LIMIT 1
        `;

        if (staffRows.length > 0) {
            const shift = String(staffRows[0].shift ?? '');
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);

            if (isWithinShiftWindow(shift, eventStart, eventEnd)) {
                throw new Error('You cannot join this event because it overlaps with your staff shift.');
            }

            const staffedOverlapRows = await tx`
                SELECT e.id
                FROM package_event_staff pes
                JOIN package_events e ON e.id = pes.event_id
                WHERE pes.staff_id = ${userId}
                  AND e.id <> ${eventId}
                  AND e.status <> 'Cancelled'
                  AND e.start_time < ${event.end_time}
                  AND e.end_time > ${event.start_time}
                LIMIT 1
            `;

            if (staffedOverlapRows.length > 0) {
                throw new Error('You cannot join this event because you are assigned to another event during that time.');
            }
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
