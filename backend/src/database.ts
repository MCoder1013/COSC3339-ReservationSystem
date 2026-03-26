import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';

dotenv.config();

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
export const sql = postgres({
    user: pgOptions.user,
    password: pgOptions.password,
    port: pgOptions.port,
    host: 'localhost',
    database: 'cruise_reservation'
});

// ensures that dates are always handled as utc
process.env.TZ = 'UTC'