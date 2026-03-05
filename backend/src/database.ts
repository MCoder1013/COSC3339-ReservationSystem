import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import postgres, { Row, RowList, TransactionSql } from 'postgres';

dotenv.config();

// ENUMS FOR DATABASE
type RoomStatus = 'Available' | 'Unavailable' | 'Maintenance';
type RoomType = 'Economy' | 'Oceanview' | 'Balcony' | "Suite";

type Categories = 'Gear' | 'Medical' | 'Event' | 'Cleaning' | 'Other';
type ResourceStatus = 'Available' | 'Out' | 'Maintenance';

type Role = 'Nurse' | 'Tour Guide' | 'Security' | 'Housekeeping' | 'Other';
type Shift = 'Morning' | 'Day' | 'Night';

type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled';

const pgOptions = {
    databaseDir: './data/db',
    user: process.env.DB_USER,
    // Password is required, so just set a placeholder if it's not set.
    password: process.env.DB_PASSWORD || 'pass',
    port: 5432,
    persistent: true
}
const pg = new EmbeddedPostgres(pgOptions);
await pg.start();
const sql = postgres({
    user: pgOptions.user,
    password: pgOptions.password,
    port: pgOptions.port,
    host: 'localhost',
    database: 'cruise_reservation'
});
// ensures that dates are always handled as utc
process.env.TZ = 'UTC'

export async function tryRegister(firstName: string, lastName: string, email: string, passwordHash: string, role: string) {
    const result = await sql`
        INSERT INTO users
            (first_name, last_name, email, password_hash, user_role)
        VALUES
            (${firstName}, ${lastName}, ${email}, ${passwordHash}, ${role})
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

export async function  updateUserProfilePicture(id: number, profilePicture: string) {
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

// pulls the resources from the resources table in the SQL 
// returns only the rows
// throws error otherwise
export async function pullResources() {
    try {
        const result = await sql`SELECT * FROM resources`;
        return result;
    } catch (error) {
        console.error("Error pulling inventory: ", error);
        throw error;
    }
}

// pull all rooms from room table
export async function pullRooms() {
    try {
        const result = await sql`SELECT * FROM cabins`;
        return result;
    } catch (error) {
        console.error("Error getting cabins: ", error);
        throw error;
    }
}

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

interface NewRoom {
    cabin_number: string
    deck: number
    type: RoomType
    capacity: number
    status: RoomStatus
}

// add a room
export async function addRoom(r: NewRoom): Promise<number> {
    try {
        if (r.cabin_number.trim() == '') {
            throw new Error("Can't have empty name");
        }

        if (r.capacity <= 0) {
            throw new Error("Capacity must be greater than 0");
        }

        if (r.deck <= 0) {
            throw new Error("Input a valid deck number");
        }

        const existing = await sql`SELECT cabin_number FROM cabins WHERE cabin_number = ${r.cabin_number}`;

        if (existing.length > 0) {
            throw new Error("Cabin number already exists");
        }

        const result = await sql`
            INSERT INTO cabins
                (cabin_number, deck, type, capacity, status)
            VALUES
                (${r.cabin_number}, ${r.deck}, ${r.type}, ${r.capacity}, ${r.status})
            RETURNING id
        `;

        return result[0].id;
    } catch (error) {
        console.error("Error adding room: ", error);
        throw error;
    }
}

// add a resource
export async function addResources(name: string, category: Categories, quantity: number, status: ResourceStatus): Promise<number> {
    try {
        if (!name || name.trim() === '') {
            throw new Error("Please provide a valid resource name");
        }

        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }

        const existing = await sql`SELECT name FROM resources WHERE name = ${name}`;

        if (existing.length > 0) {
            throw new Error("Resource name already exists");
        }

        const result = await sql`
            INSERT INTO resources
                (name, category, quantity, status)
            VALUES
                (${name}, ${category}, ${quantity}, ${status})
            RETURNING id
        `;

        return result[0].id;
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
//   id SERIAL PRIMARY KEY,
//   name VARCHAR(100) NOT NULL,
//   role ENUM('Nurse','Tour Guide','Security','Housekeeping','Other') NOT NULL DEFAULT 'Other',
//   email VARCHAR(255) NOT NULL UNIQUE,
//   shift ENUM('Morning','Day','Night') NOT NULL DEFAULT 'Day'
// );
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

// chekcs for reservations to make sure the timeslots are not currently already being used for: staff members, resources, and cabins
async function checkResourceTime(r: NewReservation, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id FROM reservations
        WHERE
            resource_id = ${r.resource_id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
    `;

    if (rows.length > 0) {
        throw new Error("That resource is already reserved in that timeframe!");
    }
}

async function checkCabinTime(r: NewReservation, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id FROM reservations
        WHERE
            cabin_id = ${r.cabin_id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
    `;

    if (rows.length > 0) {
        throw new Error("That cabin is already reserved in that timeframe!");
    }
}

async function checkStaffTime(r: NewReservation, sql: TransactionSql<{}>) {
    const rows = await sql`
        SELECT id FROM reservations
        WHERE
            staff_id = ${r.staff_id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
    `;

    if (rows.length > 0) {
        throw new Error("That staff member is already reserved in that timeframe!");
    }
}

async function checkResourceCount(
    r: NewReservation,
    sql: TransactionSql<{}>
) {
    const resourceRows = await sql`
        SELECT quantity FROM resources WHERE id = ${r.resource_id} FOR UPDATE
    `;

    if (resourceRows.length === 0) {
        throw new Error("Resource not found");
    }

    const itemQuantity = resourceRows[0].quantity;

    if (!r.quantity_reserved || r.quantity_reserved <= 0) {
        throw new Error("Quantity reserved must be greater than 0!");
    }

    const sameTimeReservations = await sql`
        SELECT quantity_reserved 
        FROM reservations
        WHERE resource_id = ${r.resource_id}
            AND start_time < ${r.end_time}
            AND end_time > ${r.start_time}
    `;

    const totalOverlaps = sameTimeReservations.reduce(
        (sum, reservation) => sum + reservation.quantity_reserved,
        0
    );

    const availableQuantity = itemQuantity - totalOverlaps;

    if (r.quantity_reserved > availableQuantity) {
        throw new Error("Not enough quantity available");
    }
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
export async function addReservation(r: NewReservation): Promise<number> {
    return await sql.begin(async sql => {
        if (r.staff_id != null) {
            await checkStaffTime(r, sql);
        }

        if (r.cabin_id != null) {
            await checkCabinTime(r, sql);
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
    });
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


// Delete room by name instead of id since users won't know id
export async function deleteRoom(cabinNumber: string): Promise<number | undefined> {
    try {
        const rows = await sql`
            DELETE FROM cabins
            WHERE cabin_number = ${cabinNumber}
            RETURNING id
        `;
        return rows[0]?.id;
    } catch (error) {
        console.error("Error deleting room: ", error);
        throw error;
    }
}

// Delete resource by name instead of id since users won't know id
export async function deleteResource(name: string): Promise<number> {
    try {
        const rows = await sql`DELETE FROM resources WHERE name = ${name} RETURNING id`;
        return rows[0]?.id;
    } catch (error) {
        console.error("Error deleting resource: ", error);
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

export async function deleteReservation(id: number): Promise<void> {
    return await sql.begin(async sql => {
        // Delete the reservation
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
  const result = await sql`
    UPDATE reservations
    SET
      start_time = COALESCE(${updates.start_time ?? null}, start_time),
      end_time = COALESCE(${updates.end_time ?? null}, end_time),
      quantity_reserved = COALESCE(${updates.quantity_reserved ?? null}, quantity_reserved)
    WHERE id = ${reservationId}
    AND user_id = ${userId}
    RETURNING *;
  `;

  if (result.length === 0) {
    throw new Error("Reservation not found or unauthorized");
  }

  return result[0];
}

// status updates

export async function updateAvailabilityStatus(
    
) {

}

// get total count remaining in the current time
export async function countRemaining(
    r: NewReservation, 
    sql: TransactionSql<{}>, 
    ): Promise<number> {

    const resourceRows = await sql`
        SELECT quantity FROM resources WHERE id = ${r.resource_id}
    `;

    if (resourceRows.length === 0) {
        throw new Error("Resource not found");
    }

    const itemQuantity = resourceRows[0].quantity;


    const overlapRows = await sql`
    SELECT COALESCE(SUM(quantity_reserved), 0) AS total_reserved
    FROM reservations
    WHERE resource_id = ${r.resource_id}
    AND start_time < ${r.end_time}
    AND end_time > ${r.start_time}
`; 

    const totalReserved = overlapRows[0].total_reserved;

    const availableQuantity = itemQuantity - totalReserved; 

    return availableQuantity; 
}