import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = await mysql.createPool({
    host: 'localhost',
    user: process.env.DB_USER,
    database: 'cruise_reservation',
    waitForConnections: true,
    connectionLimit: 10,
    password: process.env.DB_PASSWORD,
});

export async function tryRegister(email: string, passwordHash: string) {
    // this throws an error if the user already exists
    await pool.query(
        'INSERT INTO users (email, password_hash)',
        [email, passwordHash]
    );
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
