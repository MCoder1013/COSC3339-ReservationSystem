import mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ENUMS FOR DATABASE
type RoomStatus = 'Available' | 'Unavailable' | 'Maintenance';
type RoomType = 'Economy' | 'Oceanview' | 'Balcony' | "Suite";

type Categories = 'Gear' | 'Medical' | 'Event' | 'Cleaning' | 'Other';
type ResourceStatus = 'Available' | 'Out' | 'Maintenance';

type Role = 'Nurse' | 'Tour Guide' | 'Security' | 'Housekeeping' | 'Other';
type Shift = 'Morning' | 'Day' | 'Night';

type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled';

const pool = await mysql.createPool({
    host: 'localhost',
    user: process.env.DB_USER,
    database: 'cruise_reservation',
    waitForConnections: true,
    connectionLimit: 10,
    password: process.env.DB_PASSWORD,
});

export async function tryRegister(firstName: string, lastName: string, email: string, passwordHash: string) {
    const [results, fields] = await pool.query(
        'INSERT INTO users (first_name, last_name, email, password_hash) values (?, ?, ?, ?)',
        [firstName, lastName, email, passwordHash]
    );
}

export async function getUserByEmail(email: string) {
    const [rows]: [RowDataPacket[], any] = await pool.query(
        `SELECT * FROM users WHERE email = ?`,
        [email]
    );

    return rows[0]; // first user or undefined
}

// pulls the resources from the resources table in the SQL 
// returns only the rows
// throws error otherwise
export async function pullResources() {
    try {
        const [rows] = await pool.query("SELECT * FROM resources");
        return rows;
    } catch (error) {
        console.error("Error pulling inventory: ", error);
        throw error;
    }
}

// pull all rooms from room table
export async function pullRooms() {
    try {
        const [rows] = await pool.query("SELECT * FROM cabins");
        return rows;
    } catch (error) {
        console.error("Error getting cabins: ", error);
        throw error;
    }
}

// pull all staff from staff table
export async function pullStaff() {
    try {
        const [rows] = await pool.query("SELECT * FROM staff");
        return rows;
    } catch (error) {
        console.error("Error getting staff members: ", error);
        throw error;
    }
};

interface NewRoom {
    cabin_number: string
    deck: number
    type: RoomType
    capacity: number
    status: RoomStatus
}

// add a room
export async function addRoom(r: NewRoom) {
    try {
        if (r.capacity <= 0) {
            throw new Error("Capacity must be greater than 0");
        }

        const [existing]: any = await pool.query(
            "SELECT cabin_number FROM cabins WHERE cabin_number = ?",
            [r.cabin_number]
        );

        if (existing.length > 0) {
            throw new Error("Cabin number already exists");
        }

        const [results] = await pool.query("INSERT INTO cabins (cabin_number, deck, type, capacity, status) VALUES (?, ?, ?, ?, ?)",
            [r.cabin_number, r.deck, r.type, r.capacity, r.status]);

        return results;
    } catch (error) {
        console.error("Error adding room: ", error);
        throw error;
    }
}

// add a resource
export async function addResources(name: string, category: Categories, quantity: number, status: ResourceStatus) {
    try {
        if (!name || name.trim() === '') {
            throw new Error("Please provide a valid resource name");
        }

        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }

        const [existing]: any = await pool.query("SELECT name FROM resources WHERE name = ?", [name]);

        if (existing.length > 0) {
            throw new Error("Resource name already exists");
        }

        const [results] = await pool.query("INSERT INTO resources (name, category, quantity, status) VALUES (?, ?, ?, ?)",
            [name, category, quantity, status]);

        return results;
    } catch (error) {
        console.error("Error adding resources: ", error);
        throw error;
    }
}

interface NewStaff {
    name: string
    role: Role
    email: string
    shift: Shift
}

// CREATE TABLE IF NOT EXISTS staff (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   name VARCHAR(100) NOT NULL,
//   role ENUM('Nurse','Tour Guide','Security','Housekeeping','Other') NOT NULL DEFAULT 'Other',
//   email VARCHAR(255) NOT NULL UNIQUE,
//   shift ENUM('Morning','Day','Night') NOT NULL DEFAULT 'Day'
// );
// add a staff member
export async function addStaff(s: NewStaff) {
    try {
        const [results] = await pool.query("INSERT INTO staff (name, role, email, shift) VALUES (?, ?, ?, ?)",
            [s.name, s.role, s.email, s.shift]);

        return results;
    } catch (error) {
        console.error("Error adding staff: ", error);
        throw error;
    }
}

interface NewReservation {
    user_id: number
    cabin_id: number
    resource_id: number
    staff_id: number
    start_time: string
    end_time: string
}
export async function addReservation(r: NewReservation) {
    try {
        const [results] = await pool.query(
            "INSERT INTO reservations (user_id, cabin_id, resource_id, staff_id, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)",
            [
                r.user_id,
                r.cabin_id,
                r.resource_id,
                r.staff_id,
                r.start_time,
                r.end_time,
            ]
        );
        return results;
    }
    catch (error) {
        console.error("Error adding staff: ", error);
        throw error;
    }
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
}
export async function pullReservations(): Promise<Reservation[]> {
    // required info: Reservation ID, Name of Item Reserved, User Email, Start
    // Date, End Date. also, it shouldn't show reservations from the past.

    const [rows]: [RowDataPacket[], mysql.FieldPacket[]] = await pool.query(
        `SELECT
            r.id, user_id, cabin_id, resource_id, staff_id, start_time, end_time, r.status, r.created_at, u.email
        FROM
            reservations r,
            users u
        WHERE
            r.user_id = u.id AND
            r.end_time > NOW()
        `
    );

    return rows as Reservation[];
}

// Delete room by name instead of id since users won't know id
export async function deleteRoom(cabin_number: string) {
    try {
        const [results] = await pool.query("DELETE FROM cabins WHERE cabin_number = ?",
            [cabin_number]);
        return results;
    } catch (error) {
        console.error("Error deleting room: ", error);
        throw error;
    }
}

// Delete resource by name instead of id since users won't know id
export async function deleteResource(name: string) {
    try {
        const [results] = await pool.query("DELETE FROM resources WHERE name = ?",
            [name]);
        return results;
    } catch (error) {
        console.error("Error deleting resource: ", error);
        throw error;
    }
}

// Delete resource by name instead of id since users won't know id
export async function deleteStaff(id: number) {
    try {
        const [results] = await pool.query("DELETE FROM staff WHERE id = ?", [id]);
        return results;
    } catch (error) {
        console.error("Error deleting staff member: ", error);
        throw error;
    }
}


export async function deleteReservation(id: number) {
    try {
        const [results] = await pool.query("DELETE FROM reservations WHERE id = ? ", [id]);
    }
    catch (error) {
        console.error("Error deleting reservation");
        throw error;
    }
}

// Get all item reservations for a specific user
export async function getUserItemReservations(userId: number) {
    try {
        const [rows] = await pool.query(`
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
            WHERE r.user_id = ? AND r.resource_id IS NOT NULL
            ORDER BY r.start_time DESC
        `, [userId]);
        return rows;
    } catch (error) {
        console.error("Error getting user item reservations: ", error);
        throw error;
    }
}

