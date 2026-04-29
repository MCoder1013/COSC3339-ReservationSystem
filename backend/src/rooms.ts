import { sql } from './database.js';

type RoomStatus = 'Available' | 'Unavailable' | 'Maintenance';
type RoomType = 'Economy' | 'Oceanview' | 'Balcony' | "Suite";

interface NewRoom {
    cabin_number: string
    deck: number
    type: RoomType
    capacity: number
    status: RoomStatus
}

// pull all rooms from room table
export async function pullRooms() {
    try {
        const result = await sql`SELECT * FROM cabins WHERE deleted_at IS NULL`;
        return result;
    } catch (error) {
        console.error("Error getting cabins: ", error);
        throw error;
    }
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

// Delete room by name instead of id since users won't know id
export async function deleteRoom(cabinNumber: string) {
    try {
        const id = await getIdFromName(cabinNumber);

        
        const rows = await sql`
            UPDATE cabins
            SET deleted_at = NOW()
            WHERE cabin_number = ${cabinNumber}
        `;

        if(rows.count === 0) {
            throw new Error("cabin wasnt found");
        }

        await sql `UPDATE reservations SET status = 'Cancelled', cancelled_at = NOW() WHERE  cabin_id = ${id} AND status != 'Cancelled'`;

    } catch (error) {
        console.error("Error deleting room: ", error);
        throw error;
    }
}

async function getIdFromName(cabinNumber: string) {
    try {
        const rows = await sql`SELECT id FROM cabins WHERE cabin_number = ${cabinNumber}`

        return rows[0].id;
    } catch(error) {
        console.log(error); 
        throw error;
    }
}