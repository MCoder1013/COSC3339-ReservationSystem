import { sql } from './database.js';

type Role = 'Nurse' | 'Tour Guide' | 'Security' | 'Housekeeping' | 'Other';
type Shift = 'Morning' | 'Day' | 'Night';

interface NewStaff {
    name: string
    role: Role
    email: string
    shift: Shift
}

// pull all staff from staff table
export async function pullStaff() {
    try {
        const result = await sql`SELECT * FROM staff`;
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
        const rows = await sql`DELETE FROM staff WHERE id = ${id} RETURNING id`;
        return rows[0]?.id;
    } catch (error) {
        console.error("Error deleting staff member: ", error);
        throw error;
    }
}


export async function getStaffNameFromID(id: number): Promise<string> {

    const staffName = await sql`
    SELECT name FROM staff WHERE id = ${id}
    `;

    return staffName[0].name; 
}