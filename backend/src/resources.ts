import { sql } from './database.js';
import { TransactionSql } from 'postgres';

type Categories = 'Gear' | 'Medical' | 'Event' | 'Cleaning' | 'Other';
type ResourceStatus = 'Available' | 'Out' | 'Maintenance';

interface ResourceCountCheck {
    resource_id: number
    quantity_reserved: number
    start_time: string
    end_time: string
    cruise_id: number | null
}

// pulls the resources from the resources table in the SQL
// returns only the rows
// throws error otherwise
export async function pullResources() {
    try {
        const result = await sql`SELECT * FROM resources WHERE deleted_at IS NULL`;
        return result;
    } catch (error) {
        console.error("Error pulling inventory: ", error);
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

export async function checkResourceCount(
    r: ResourceCountCheck,
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
            AND cruise_id IS NOT DISTINCT FROM ${r.cruise_id}
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

// Delete resource by name instead of id since users won't know id
export async function deleteResource(name: string): Promise<number> {
    try {
        const rows = await sql`UPDATE resources SET deleted_at = NOW() WHERE name = ${name} RETURNING id`;

        if(rows.count === 0) {
            throw new Error("no resource exists with this name")
        }
        return rows[0]?.id;
    } catch (error) {
        console.error("Error deleting resource: ", error);
        throw error;
    }
}

// get total count remaining in the current time
export async function countRemaining(
    r: {
        resource_id: number,
        start_time: string,
        end_time: string,
        cruise_id: number | null
    }
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
        AND cruise_id IS NOT DISTINCT FROM ${r.cruise_id}
        AND start_time < ${r.end_time}
        AND end_time > ${r.start_time}
    `;

    const totalReserved = overlapRows[0].total_reserved;
    const availableQuantity = itemQuantity - totalReserved;

    return availableQuantity;
}


export async function getItemFromID (id : number) { 
    const resourceRows = await sql`SELECT name FROM resources WHERE id = ${id}`;
     
    if(resourceRows.length == 0) {
        throw new Error("Resource not found"); 
    }

    const resourceID = resourceRows[0].name;

    return resourceID;

}