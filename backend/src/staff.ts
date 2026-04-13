import { sql } from './database.js';

export type StaffRole = 'Nurse' | 'Tour Guide' | 'Security' | 'Housekeeping' | 'Other';
type Shift = 'Morning' | 'Day' | 'Night';

interface NewStaff {
    name: string
    role: StaffRole
    email: string
    shift: Shift
}

// pull all staff from staff table
export async function pullStaff() {
    try {
        const result = await sql`
            SELECT
                s.staff_id AS id,
                s.role,
                s.shift,
                COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''), u.email, CAST(s.staff_id AS TEXT)) AS name,
                u.email
            FROM staff s
            LEFT JOIN users u ON u.id = s.staff_id
            WHERE deleted_at IS NULL
            ORDER BY name 
        `;
        return result;
    } catch (error) {
        console.error("Error getting staff members: ", error);
        throw error;
    }
}

// add a staff member
export async function addStaff(s: NewStaff): Promise<number> {
    try {
        const result = await sql`
            INSERT INTO staff
                (name, role, email, shift)
            VALUES
                (${s.name}, ${s.role}, ${s.email}, ${s.shift})
            RETURNING id
        `;

        return result[0].id;
    } catch (error) {
        console.error("Error adding staff: ", error);
        throw error;
    }
}

export async function deleteStaff(id: number): Promise<number | undefined> {
    try {
        const rows = await sql`UPDATE staff SET deleted_at = NOW() WHERE staff_id = ${id} RETURNING id`;

        if(rows.count === 0) {
            throw new Error("No staff has that id");
        }

        return rows[0]?.id;
    } catch (error) {
        console.error("Error deleting staff member: ", error);
        throw error;
    }
}


export async function getStaffNameFromID(id: number): Promise<string> {

    const staffName = await sql`
    SELECT name FROM staff WHERE staff_id = ${id}
    `;

    return staffName[0].name; 
}