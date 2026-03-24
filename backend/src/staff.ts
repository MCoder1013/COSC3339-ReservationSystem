import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import postgres, { Row, RowList, TransactionSql } from 'postgres';
import {sql} from '../src/database.js';

dotenv.config();

// ENUMS FOR DATABASE
type RoomStatus = 'Available' | 'Unavailable' | 'Maintenance';
type RoomType = 'Economy' | 'Oceanview' | 'Balcony' | "Suite";

type Categories = 'Gear' | 'Medical' | 'Event' | 'Cleaning' | 'Other';
type ResourceStatus = 'Available' | 'Out' | 'Maintenance';

type Role = 'Nurse' | 'Tour Guide' | 'Security' | 'Housekeeping' | 'Other';
type Shift = 'Morning' | 'Day' | 'Night';

type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled';


// ensures that dates are always handled as utc
process.env.TZ = 'UTC';

// pull all staff from staff table
export async function pullStaff() {
    try {
        const result = await sql`SELECT * FROM staff"`;
        return result;
    } catch (error) {
        console.error("Error getting staff members: ", error);
        throw error;
    }
};


interface NewStaff {
    name: string
    role: Role
    email: string
    shift: Shift
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

