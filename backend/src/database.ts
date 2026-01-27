import mysql from 'mysql2/promise';

let connection: mysql.Connection
try {
    connection = await mysql.createConnection({
        host: 'localhost',
        user: 'cruise_app',
        database: 'cruise_reservation',
    });
} catch {
    console.error('Failed to connect to database!')
}

export async function tryRegister(email: string, passwordHash: string) {
    const [results, fields] = await connection.query(
        'INSERT INTO users (email, password_hash)',
        [email, passwordHash]
    );

    // TODO
}