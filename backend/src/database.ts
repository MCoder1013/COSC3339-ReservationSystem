import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ENUMS FOR DATABASE
type RoomStatus = 'Available' | 'Unavailable' | 'Maintenance';
type RoomType = 'Economy' | 'Oceanview' | 'Balcony' | "Suite";

type Categories = 'Gear' | 'Medical' | 'Event' | 'Cleaning' | 'Other';
type ResourceStatus = 'Available' | 'Out' | 'Maintenance';

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

// pulls the resources from the resources table in the SQL 
// returns only the rows
// throws error otherwise
export async function pullResources(){
    try {
        const[rows] = await pool.query("SELECT * FROM resources");
        return rows;
    } catch (error) {
        console.error("Error pulling inventory: ", error); 
        throw error;
    }
}

// pull all rooms from room table
export async function pullRooms() {
    try {
        const[rows] = await pool.query("SELECT * FROM cabins");
        return rows;
    } catch (error) {
        console.error("Error getting cabins: ", error);
        throw error;
    }
}

// add a room
export async function addRoom(cabin_number: string, deck: number, type: RoomType, capacity: number, status: RoomStatus){
    try {
        const[results] = await pool.query("INSERT INTO rooms (cabin_number, deck, type, capacity, status) VALUES (?, ?, ?, ?, ?)", 
            [cabin_number, deck, type, capacity, status]);

        return results;
    } catch(error) {
        console.error("Error adding room: ", error); 
        throw error;
    }
}

// add a resource
export async function addResources(name: string, category: Categories, quantity: number, status: ResourceStatus){
    try {
        const[results] = await pool.query("INSERT INTO resources (name, category, quantity, status) VALUES (?, ?, ?, ?)", 
            [name, category, quantity, status]);

        return results;
    } catch(error) {
        console.error("Error adding resources: ", error); 
        throw error;
    }
}


// Delete a room by its ID
export async function deleteRoom(id: number) {
    try {
        const [results] = await pool.query(
            "DELETE FROM cabins WHERE id = ?", 
            [id]
        );
        return results;
    } catch (error) {
        console.error("Error deleting room: ", error);
        throw error;
    }
}

// delete resource by id
export async function deleteResource(id: number) {
    try {
        const [results] = await pool.query(
            "DELETE FROM resources WHERE id = ?", 
            [id]
        );
        return results;
    } catch (error) {
        console.error("Error deleting resources: ", error); 
        throw error;
    }
}

