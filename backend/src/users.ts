import { sql } from './database.js';

type CruiseDateRange = {
    id: number;
    departure_date: string;
    return_date: string;
};

export async function tryRegister(firstName: string, lastName: string, email: string, passwordHash: string, role: string) {
    const result = await sql`
        INSERT INTO users
            (first_name, last_name, email, password_hash, user_role)
        VALUES
            (${firstName}, ${lastName}, ${email}, ${passwordHash}, ${role})
        RETURNING id;
    `;

    return result[0].id;
}

export async function insertStaff(staff_id: number, role: string, shift: string) {
  await sql`
    INSERT INTO staff
      (staff_id, role, shift)
    VALUES
      (${staff_id}, ${role}, ${shift});
  `;
}

export async function getUserByEmail(email: string) {
    const result = await sql`SELECT * FROM users WHERE email = ${email}`;
    return result[0]; // first user or undefined
}

export async function getUserById(id: number) {
    const result = await sql`SELECT * FROM users WHERE id = ${id}`;
    return result[0] ?? null;
}

export async function updateUserProfile(id: number, biography: string, profilePicture: string) {
    await sql`
    UPDATE users
    SET biography = ${biography}, profile_picture = ${profilePicture}
    WHERE id = ${id}
  `;
}

export async function updateUserBiography(id: number, biography: string) {
    await sql`UPDATE users SET biography = ${biography} WHERE id = ${id}`;
}

export async function updateUserProfilePicture(id: number, profilePicture: string) {
    await sql`UPDATE users SET profile_picture = ${profilePicture} WHERE id = ${id}`;
}

export async function getAllUsers() {
    const result = await sql`
        SELECT id, first_name, last_name, email, user_role, created_at
        FROM users
        ORDER BY id ASC
    `;
    return result;
}

export async function getStaffRoleByUserId(userId: number): Promise<string | null> {
    const result = await sql`
        SELECT role
        FROM staff
        WHERE staff_id = ${userId}
        LIMIT 1
    `;

    return (result[0]?.role as string | undefined) ?? null;
}

export async function isUserStaffAdmin(userId: number): Promise<boolean> {
    const staffRole = await getStaffRoleByUserId(userId);
    return staffRole?.trim().toLowerCase() === 'admin';
}

export async function updateUserRole(userId: number, newRole: string): Promise<void> {
    await sql`
        UPDATE users
        SET user_role = ${newRole}
        WHERE id = ${userId}
    `;
}

export async function upsertStaffRecord(staffId: number, role: string, shift = 'Day'): Promise<void> {
    await sql`
        INSERT INTO staff (staff_id, role, shift)
        VALUES (${staffId}, ${role}, ${shift})
        ON CONFLICT (staff_id)
        DO UPDATE SET role = EXCLUDED.role
    `;
}

export async function removeStaffRecord(staffId: number): Promise<void> {
    await sql`DELETE FROM staff WHERE staff_id = ${staffId}`;
}

export async function getStaffCruiseIdsByUserId(userId: number): Promise<number[]> {
    const rows = await sql`
        SELECT cruise_id
        FROM staff_cruises
        WHERE staff_id = ${userId}
        ORDER BY cruise_id ASC
    `;

    return rows.map((r) => Number(r.cruise_id));
}

export async function getStaffAssignedCruises(userId: number) {
    return await sql`
        SELECT
            c.id,
            c.cruise_name,
            c.ship_name,
            c.departure_date,
            c.return_date
        FROM staff_cruises sc
        JOIN cruises c ON c.id = sc.cruise_id
        WHERE sc.staff_id = ${userId}
        ORDER BY c.departure_date ASC, c.id ASC
    `;
}

export async function getCurrentStaffAssignedCruises(userId: number) {
    return await sql`
        SELECT
            c.id,
            c.cruise_name,
            c.ship_name,
            c.departure_date,
            c.return_date
        FROM staff_cruises sc
        JOIN cruises c ON c.id = sc.cruise_id
        WHERE sc.staff_id = ${userId}
          AND c.return_date >= CURRENT_DATE
        ORDER BY c.departure_date ASC, c.id ASC
    `;
}

function hasCruiseDateOverlap(a: CruiseDateRange, b: CruiseDateRange): boolean {
    const aStart = new Date(a.departure_date);
    const aEnd = new Date(a.return_date);
    const bStart = new Date(b.departure_date);
    const bEnd = new Date(b.return_date);
    return aStart < bEnd && bStart < aEnd;
}

export async function validateStaffCruiseAssignment(staffId: number, cruiseIds: number[]): Promise<void> {
    const uniqueCruiseIds = [...new Set(cruiseIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueCruiseIds.length <= 1) {
        return;
    }

    const cruises = await sql`
        SELECT id, departure_date, return_date
        FROM cruises
        WHERE id IN ${sql(uniqueCruiseIds)}
        ORDER BY departure_date ASC
    ` as CruiseDateRange[];

    if (cruises.length !== uniqueCruiseIds.length) {
        throw new Error('One or more selected cruises could not be found.');
    }

    for (let i = 0; i < cruises.length; i += 1) {
        for (let j = i + 1; j < cruises.length; j += 1) {
            if (hasCruiseDateOverlap(cruises[i], cruises[j])) {
                throw new Error('Selected cruises overlap. Staff can only be assigned to non-overlapping cruises.');
            }
        }
    }

    const existing = await sql`
        SELECT c.id, c.departure_date, c.return_date
        FROM staff_cruises sc
        JOIN cruises c ON c.id = sc.cruise_id
        WHERE sc.staff_id = ${staffId}
          AND sc.cruise_id NOT IN ${sql(uniqueCruiseIds)}
    ` as CruiseDateRange[];

    for (const currentCruise of cruises) {
        for (const assignedCruise of existing) {
            if (hasCruiseDateOverlap(currentCruise, assignedCruise)) {
                throw new Error('Selected cruises overlap with this staff member\'s existing cruise assignments.');
            }
        }
    }
}

export async function addStaffCruiseAssignment(staffId: number, cruiseId: number): Promise<void> {
    await validateStaffCruiseAssignment(staffId, [cruiseId]);
    await sql`
        INSERT INTO staff_cruises (staff_id, cruise_id)
        VALUES (${staffId}, ${cruiseId})
        ON CONFLICT (staff_id, cruise_id) DO NOTHING
    `;
}

export async function removeStaffCruiseAssignment(staffId: number, cruiseId: number): Promise<void> {
    await sql`
        DELETE FROM staff_cruises
        WHERE staff_id = ${staffId}
          AND cruise_id = ${cruiseId}
    `;
}

export async function replaceStaffCruiseAssignments(staffId: number, cruiseIds: number[]): Promise<void> {
    const normalizedCruiseIds = [...new Set(cruiseIds.filter((id) => Number.isInteger(id) && id > 0))];
    await validateStaffCruiseAssignment(staffId, normalizedCruiseIds);

    await sql.begin(async (tx) => {
        await tx`DELETE FROM staff_cruises WHERE staff_id = ${staffId}`;
        for (const cruiseId of normalizedCruiseIds) {
            await tx`
                INSERT INTO staff_cruises (staff_id, cruise_id)
                VALUES (${staffId}, ${cruiseId})
                ON CONFLICT (staff_id, cruise_id) DO NOTHING
            `;
        }
    });
}

// Validate guest emails and return their user IDs
export async function validateGuestEmails(emails: string[]): Promise<{ valid: boolean; userIds: number[]; invalidEmails: string[] }> {
    const userIds: number[] = [];
    const invalidEmails: string[] = [];

    for (const email of emails) {
        const user = await getUserByEmail(email.trim());
        if (user) {
            userIds.push(user.id);
        } else {
            invalidEmails.push(email);
        }
    }

    return {
        valid: invalidEmails.length === 0,
        userIds,
        invalidEmails
    };
}