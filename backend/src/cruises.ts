import { sql } from './database.js';

export async function pullCruises() {
    try {
        const result = await sql`
            SELECT
                id,
                cruise_name,
                ship_name,
                departure_date,
                return_date,
                max_passengers
            FROM cruises
            ORDER BY departure_date ASC
        `;
        return result;
    } catch (error) {
        console.error('Error pulling cruises:', error);
        throw error;
    }
}
