import mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2/promise';
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

export async function tryRegister(
  firstName: string,
  lastName: string,
  email: string,
  passwordHash: string
) {
  await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash)
     VALUES (?, ?, ?, ?)`,
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
export async function pullResources(){
    try {
        const[rows] = await pool.query("SELECT * FROM resources");
        return rows;
    } catch (error) {
        console.error("Error pulling inventory: ", error); 
        throw error;
    }
}



